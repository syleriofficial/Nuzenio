from nuzenio_api.pipeline.demo import (
    DeterministicCanonicalizer,
    DeterministicClassifier,
    DeterministicDuplicateDetector,
    EvidenceFirstSummaryGenerator,
    independent_source_count,
    merge_clusters,
    split_cluster,
)
from nuzenio_api.pipeline.interfaces import (
    EvidenceMappedSentence,
    MutableCluster,
    PipelineArticle,
)


def article(
    article_id: str,
    organization: str,
    title: str = "Cabinet approves clean mobility framework",
    excerpt: str = "The cabinet approved a clean mobility framework for intercity corridors.",
    **kwargs: object,
) -> PipelineArticle:
    return PipelineArticle(
        article_id=article_id,
        publisher_organization_id=organization,
        url=f"https://{organization}.example/{article_id}",
        title=title,
        excerpt=excerpt,
        **kwargs,
    )


def test_canonical_url_removes_tracking_and_normalizes() -> None:
    canonicalizer = DeterministicCanonicalizer()
    assert (
        canonicalizer.canonicalize("HTTP://News.Example//story/?utm_source=social&b=2&a=1#section")
        == "https://news.example/story?a=1&b=2"
    )


def test_exact_duplicate_detection_is_stable() -> None:
    detector = DeterministicDuplicateDetector()
    first = article("a1", "org-a")
    second = article(
        "a2",
        "org-a",
        title="  CABINET approves clean mobility framework ",
        excerpt="The cabinet approved a clean mobility framework   for intercity corridors.",
    )
    assert detector.exact_fingerprint(first) == detector.exact_fingerprint(second)


def test_probable_syndicated_copy_detects_near_identical_cross_org_text() -> None:
    detector = DeterministicDuplicateDetector()
    assert detector.is_syndicated_copy(article("a1", "wire"), article("a2", "publisher"))


def test_organization_level_source_count_combines_domains_and_wire_copies() -> None:
    articles = [
        article("a1", "org-a"),
        article("a2", "org-a", title="A follow-up headline"),
        article("a3", "org-b"),
        article(
            "a4",
            "org-c",
            is_syndicated_copy=True,
            syndication_origin_organization_id="org-b",
        ),
    ]
    assert independent_source_count(articles) == 2


def test_cluster_merge_deduplicates_article_membership() -> None:
    merged = merge_clusters(
        [MutableCluster("one", ["a1", "a2"]), MutableCluster("two", ["a2", "a3"])],
        "merged",
    )
    assert merged.cluster_id == "merged"
    assert merged.article_ids == ["a1", "a2", "a3"]


def test_cluster_split_requires_complete_non_overlapping_partition() -> None:
    cluster = MutableCluster("one", ["a1", "a2", "a3"])
    split = split_cluster(cluster, [["a1"], ["a2", "a3"]], ["left", "right"])
    assert [item.article_ids for item in split] == [["a1"], ["a2", "a3"]]


def test_cluster_split_rejects_missing_articles() -> None:
    cluster = MutableCluster("one", ["a1", "a2", "a3"])
    try:
        split_cluster(cluster, [["a1"], ["a2"]], ["left", "right"])
    except ValueError as exc:
        assert "every cluster article" in str(exc)
    else:
        raise AssertionError("invalid split was accepted")


def test_evidence_free_summary_is_suppressed() -> None:
    generator = EvidenceFirstSummaryGenerator()
    assert generator.generate([EvidenceMappedSentence("An unsupported factual sentence.")]) is None


def test_summary_only_includes_evidence_mapped_sentences() -> None:
    generator = EvidenceFirstSummaryGenerator()
    summary = generator.generate(
        [
            EvidenceMappedSentence("The framework was approved.", ("article-1",)),
            EvidenceMappedSentence("An unsupported motive was inferred."),
        ]
    )
    assert summary is not None
    assert summary.text == "The framework was approved."
    assert summary.evidence_map == {0: ("article-1",)}


def test_public_safety_story_requires_editorial_review() -> None:
    classification = DeterministicClassifier().classify(
        [article("a1", "org-a", title="Delhi air quality public safety response")]
    )
    assert classification.editorial_review_required is True
    assert "air quality" in classification.risk_labels
