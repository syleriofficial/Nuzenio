from datetime import UTC, datetime

from nuzenio_api.schemas import ClaimSummary, ClusterSummary, SourceSummary

DEMO_CLUSTERS = [
    ClusterSummary(
        slug="national-clean-mobility-framework",
        headline="Union cabinet clears framework for cleaner intercity transport",
        brief=(
            "The Union cabinet approved a demonstration clean-mobility framework for "
            "major intercity corridors. The first phase focuses on charging standards "
            "and shared data; routes and funding have not been published."
        ),
        category="National",
        status="DEVELOPING",
        independent_source_count=3,
        risk_level="STANDARD",
        review_state="PUBLISHED",
        sources=[
            SourceSummary(
                name="Janadesh",
                organization_id="org-janadesh",
                domain="janadesh.example",
                headline="Cabinet backs national clean transport framework",
                url="https://example.com/janadesh-clean-transport",
                language="hi",
            ),
            SourceSummary(
                name="The Civic Ledger",
                organization_id="org-civic-ledger",
                domain="civicledger.example",
                headline="Centre sets common standards for intercity charging",
                url="https://example.com/civic-ledger-mobility",
            ),
            SourceSummary(
                name="Bharat Wire",
                organization_id="org-bharat-wire",
                domain="bharatwire.example",
                headline="New mobility plan receives cabinet approval",
                url="https://example.com/bharat-wire-plan",
            ),
        ],
        claims=[
            ClaimSummary(
                state="CONFIRMED",
                text="The cabinet approved the framework.",
                evidence_ids=["janadesh-1", "bharat-wire-1"],
            ),
            ClaimSummary(
                state="DEVELOPING",
                text="Routes and funding have not been published.",
                evidence_ids=["civic-ledger-1"],
            ),
        ],
        updated_at=datetime(2026, 9, 2, 10, 14, tzinfo=UTC),
    ),
    ClusterSummary(
        slug="delhi-air-quality-response",
        headline="Delhi agencies prepare phased response after air quality worsens",
        brief=(
            "Delhi pollution-control teams deployed additional monitoring units. "
            "No school or construction restrictions are in force while wind forecasts "
            "are assessed."
        ),
        category="Delhi NCR",
        location="Delhi NCR",
        status="DEVELOPING",
        independent_source_count=3,
        risk_level="HIGH",
        review_state="EDITOR_REVIEWED",
        sources=[
            SourceSummary(
                name="Delhi Chronicle",
                organization_id="org-delhi-chronicle",
                domain="delhichronicle.example",
                headline="Monitoring stepped up as Delhi air worsens",
                url="https://example.com/delhi-air",
            ),
            SourceSummary(
                name="Capital Civic",
                organization_id="org-capital-civic",
                domain="capitalcivic.example",
                headline="No curbs yet as agencies review pollution forecast",
                url="https://example.com/capital-air",
            ),
            SourceSummary(
                name="Cityline Hindi",
                organization_id="org-cityline",
                domain="citylinehindi.example",
                headline="दिल्ली में वायु निगरानी बढ़ाई गई",
                url="https://example.com/cityline-air",
                language="hi",
            ),
        ],
        claims=[
            ClaimSummary(
                state="CONFIRMED",
                text="Additional monitoring units were deployed.",
                evidence_ids=["delhi-chronicle-1", "capital-civic-1"],
            )
        ],
        updated_at=datetime(2026, 9, 2, 9, 18, tzinfo=UTC),
    ),
]
