'use client';

import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { usePreferences } from '@/lib/preferences';
import {
  reportCategories,
  ReportSubmissionError,
  submitReaderReport,
  newSubmissionId,
} from '@/lib/reader-report';

export function ReaderReportForm({
  slug,
  onClose,
}: {
  slug: string;
  onClose: () => void;
}) {
  const { language, t } = usePreferences();
  const formId = useId();
  const [category, setCategory] =
    useState<(typeof reportCategories)[number]>('INACCURATE');
  const [details, setDetails] = useState('');
  const [pending, setPending] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const attempt = useRef<{ fingerprint: string; id: string } | null>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
    },
    [],
  );

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (active.current || accepted) return;
    const content = {
      storySlug: slug,
      language,
      category,
      details: details.trim(),
    };
    if (content.details.length < 10 || content.details.length > 2000) {
      setError(t('Use 10–2,000 characters.', '10–2,000 अक्षर लिखें।'));
      return;
    }
    const fingerprint = JSON.stringify(content);
    try {
      if (attempt.current?.fingerprint !== fingerprint)
        attempt.current = { fingerprint, id: newSubmissionId() };
    } catch {
      setError(
        t(
          'Secure submission is unavailable in this browser.',
          'इस ब्राउज़र में सुरक्षित रिपोर्ट भेजना उपलब्ध नहीं है।',
        ),
      );
      return;
    }
    const controller = new AbortController();
    active.current = controller;
    const deadline = setTimeout(() => controller.abort(), 12000);
    setPending(true);
    setError('');
    try {
      await submitReaderReport(
        { ...content, submissionId: attempt.current.id },
        controller.signal,
      );
      if (active.current === controller) {
        setAccepted(true);
        setDetails('');
      }
    } catch (caught) {
      if (active.current !== controller) return;
      const status =
        caught instanceof ReportSubmissionError ? caught.status : 503;
      setError(
        status === 429
          ? t(
              'Too many attempts. Wait a minute before retrying.',
              'बहुत अधिक प्रयास। एक मिनट बाद फिर कोशिश करें।',
            )
          : status === 404
            ? t(
                'This story is no longer available for reporting.',
                'इस स्टोरी पर अब रिपोर्ट नहीं भेजी जा सकती।',
              )
            : t(
                'Submission could not be confirmed. Your text is still here; retry safely.',
                'रिपोर्ट की पुष्टि नहीं हुई। आपका विवरण यहीं है; फिर कोशिश करें।',
              ),
      );
    } finally {
      clearTimeout(deadline);
      if (active.current === controller) {
        active.current = null;
        setPending(false);
      }
    }
  }

  return (
    <form className="report-form" onSubmit={submit} aria-busy={pending}>
      <h2>{t('Report an issue', 'मुद्दा रिपोर्ट करें')}</h2>
      <p>
        {t(
          'Reports are private to the editorial team. Do not include passwords, contact details or other sensitive personal data. This does not automatically change the story.',
          'रिपोर्ट केवल संपादकीय टीम देखेगी। पासवर्ड, संपर्क विवरण या संवेदनशील निजी जानकारी न दें। इससे स्टोरी अपने आप नहीं बदलेगी।',
        )}
      </p>
      {accepted ? (
        <output>
          {t(
            'Issue submitted for editorial review',
            'मुद्दा संपादकीय समीक्षा के लिए भेजा गया',
          )}
        </output>
      ) : (
        <>
          <label htmlFor={`${formId}-category`}>
            {t('Issue type', 'मुद्दे का प्रकार')}
          </label>
          <select
            id={`${formId}-category`}
            value={category}
            disabled={pending}
            onChange={(event) =>
              setCategory(event.target.value as typeof category)
            }
          >
            {reportCategories.map((value, i) => (
              <option key={value} value={value}>
                {language === 'hi'
                  ? ['गलत जानकारी', 'पुरानी जानकारी', 'अस्पष्ट', 'अन्य'][i]
                  : ['Inaccurate', 'Outdated', 'Unclear', 'Other'][i]}
              </option>
            ))}
          </select>
          <label htmlFor={`${formId}-details`}>{t('Details', 'विवरण')}</label>
          <Textarea
            id={`${formId}-details`}
            name="details"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            required
            minLength={10}
            maxLength={2000}
            disabled={pending}
          />
          {error && <p role="alert">{error}</p>}
          <Button type="submit" disabled={pending}>
            {pending ? t('Submitting…', 'भेज रहे हैं…') : t('Submit', 'भेजें')}
          </Button>
        </>
      )}
      <Button type="button" variant="ghost" onClick={onClose}>
        {t('Close', 'बंद करें')}
      </Button>
    </form>
  );
}
