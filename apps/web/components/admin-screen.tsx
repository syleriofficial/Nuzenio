'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  GitMerge,
  HeartPulse,
  PencilLine,
  ShieldAlert,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const tabs = [
  { id: 'sources', label: 'Source registry' },
  { id: 'health', label: 'Feed health' },
  { id: 'clusters', label: 'Merge / split' },
  { id: 'corrections', label: 'Corrections' },
  { id: 'risk', label: 'High-risk review' },
] as const;

export function AdminScreen() {
  const [active, setActive] = useState<(typeof tabs)[number]['id']>('sources');
  const [message, setMessage] = useState('');
  return (
    <>
      <section className="admin-heading">
        <div>
          <p className="eyebrow">Nuzenio operations</p>
          <h1>Editorial control room</h1>
          <p>
            Demo-only operational surfaces. Every mutation would be recorded in
            AuditLog.
          </p>
        </div>
        <Badge variant="outline">Local demonstration</Badge>
      </section>
      <nav className="admin-tabs" aria-label="Admin sections">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={active === tab.id ? 'default' : 'ghost'}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </nav>
      {active === 'sources' && (
        <section className="admin-panel">
          <header>
            <div>
              <h2>Source registry</h2>
              <p>Approved organisations, domains, rights and feed policy.</p>
            </div>
            <Button onClick={() => setMessage('New source review opened')}>
              Add source
            </Button>
          </header>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Organisation</th>
                  <th>Domains</th>
                  <th>Rights</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>Janadesh Media Group</strong>
                    <small>Hindi · National</small>
                  </td>
                  <td>2 verified</td>
                  <td>Excerpt + link</td>
                  <td>
                    <Badge variant="outline">Approved</Badge>
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Delhi Chronicle Network</strong>
                    <small>English · Local</small>
                  </td>
                  <td>2 verified</td>
                  <td>Headline + link</td>
                  <td>
                    <Badge variant="outline">Approved</Badge>
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Bharat Wire Cooperative</strong>
                    <small>English / Hindi · Wire</small>
                  </td>
                  <td>1 verified</td>
                  <td>Licensed API</td>
                  <td>
                    <Badge variant="outline">Approved</Badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
      {active === 'health' && (
        <section className="admin-panel">
          <header>
            <div>
              <h2>Feed health</h2>
              <p>Freshness, parsing, rights and delivery signals.</p>
            </div>
            <HeartPulse />
          </header>
          <div className="health-grid">
            <article>
              <CheckCircle2 className="ok" />
              <strong>Janadesh RSS</strong>
              <span>Last item 4 min ago</span>
              <small>99.8% parse rate</small>
            </article>
            <article>
              <AlertTriangle className="warn" />
              <strong>Bharat Wire API</strong>
              <span>17 min behind baseline</span>
              <small>Retry scheduled</small>
            </article>
            <article>
              <CheckCircle2 className="ok" />
              <strong>Delhi Chronicle RSS</strong>
              <span>Last item 8 min ago</span>
              <small>100% parse rate</small>
            </article>
          </div>
        </section>
      )}
      {active === 'clusters' && (
        <section className="admin-panel">
          <header>
            <div>
              <h2>Cluster merge / split</h2>
              <p>
                Human override for event boundaries. Preview before applying.
              </p>
            </div>
            <GitMerge />
          </header>
          <div className="cluster-review">
            <article>
              <small>Candidate A · similarity 0.88</small>
              <h3>Clean mobility framework</h3>
              <p>4 organisations · 6 articles</p>
            </article>
            <span>+</span>
            <article>
              <small>Candidate B · similarity 0.81</small>
              <h3>Charging-standard announcement</h3>
              <p>2 organisations · 3 articles</p>
            </article>
          </div>
          <div className="panel-actions">
            <Button onClick={() => setMessage('Merge preview generated')}>
              Preview merge
            </Button>
            <Button
              variant="outline"
              onClick={() => setMessage('Split editor opened')}
            >
              Open split editor
            </Button>
          </div>
        </section>
      )}
      {active === 'corrections' && (
        <section className="admin-panel">
          <header>
            <div>
              <h2>Corrections</h2>
              <p>Source corrections, cluster updates and visible history.</p>
            </div>
            <PencilLine />
          </header>
          <div className="correction-item">
            <div>
              <Badge variant="outline">Open</Badge>
              <h3>Mobility framework route wording</h3>
              <p>
                Source advisory says the two corridors are examples, not
                selected pilots.
              </p>
              <small>Raised 10:09 IST · affects one summary sentence</small>
            </div>
            <Button onClick={() => setMessage('Correction workflow opened')}>
              Review
            </Button>
          </div>
        </section>
      )}
      {active === 'risk' && (
        <section className="admin-panel">
          <header>
            <div>
              <h2>High-risk review queue</h2>
              <p>
                Elections, communal violence, war, public safety, health
                emergencies and market-moving stories require editorial state.
              </p>
            </div>
            <ShieldAlert />
          </header>
          <div className="risk-item">
            <span className="risk-level">PUBLIC SAFETY</span>
            <div>
              <h3>Delhi agencies prepare phased air-quality response</h3>
              <p>
                3 organisations · evidence coverage 100% · no unsupported
                sentences
              </p>
            </div>
            <Button onClick={() => setMessage('Review record opened')}>
              Open review
            </Button>
          </div>
          <div className="empty-mini">
            <CheckCircle2 /> No other high-risk clusters are awaiting review.
          </div>
        </section>
      )}
      <output className="admin-toast" aria-live="polite">
        {message}
      </output>
    </>
  );
}
