import { useEffect, useMemo, useState } from 'react';
import {
  Link,
  NavLink,
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom';
import {
  Activity,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock3,
  CloudUpload,
  FileCheck2,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { imageUrl, request } from './api';

const statusLabels = {
  submitted: 'New submission',
  under_review: 'In review',
  needs_more_info: 'Needs information',
  assessed: 'Assessed',
};
const formatDate = (value) =>
  value
    ? new Date(
        value.includes('T') ? value : `${value}T12:00:00`,
      ).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';
const claimNumber = (id) => `CLM-${String(id).padStart(4, '0')}`;

function Status({ value }) {
  return (
    <span className={`status status-${value || 'submitted'}`}>
      <span className='status-dot' />
      {statusLabels[value] || value}
    </span>
  );
}

function Shell({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const link = (to, Icon, label) => (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={() => setMenuOpen(false)}
      className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}
    >
      <Icon size={18} strokeWidth={1.7} />
      <span>{label}</span>
      {to === '/new' && <Plus size={15} className='link-tail' />}
    </NavLink>
  );
  return (
    <div className='app-shell'>
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <Link to='/' className='brand' onClick={() => setMenuOpen(false)}>
          <span className='brand-symbol'>
            <Activity size={21} strokeWidth={2.2} />
          </span>
          <span>
            accord<span className='brand-period'>.</span>
            <small>ASSESSMENT STUDIO</small>
          </span>
        </Link>
        <div className='workspace-switch'>
          <span className='workspace-icon'>A</span>
          <span>
            <b>Assessment workspace</b>
            <small>Local development</small>
          </span>
          <ChevronDown size={15} />
        </div>
        <div className='nav-label'>WORKSPACE</div>
        <nav aria-label='Main navigation'>
          {link('/', LayoutDashboard, 'Overview')}
          {link('/claims', ClipboardList, 'All claims')}
          {link('/new', Plus, 'New claim')}
        </nav>
        <div className='sidebar-bottom'>
          <div className='help-card'>
            <span className='help-icon'>
              <ShieldCheck size={19} />
            </span>
            <b>Human review matters</b>
            <p>
              Every assessment is preliminary until verified by a qualified
              reviewer.
            </p>
            <Link to='/new'>
              Start a claim <ArrowRight size={14} />
            </Link>
          </div>
          <div className='side-footer'>
            <span className='avatar'>AS</span>
            <span>
              <b>Assessment team</b>
              <small>Demo workspace</small>
            </span>
            <span className='online-dot' />
          </div>
        </div>
      </aside>
      {menuOpen && (
        <button
          className='menu-backdrop'
          aria-label='Close menu'
          onClick={() => setMenuOpen(false)}
        />
      )}
      <div className='main-column'>
        <header className='topbar'>
          <button
            className='mobile-menu'
            onClick={() => setMenuOpen(true)}
            aria-label='Open menu'
          >
            <Menu size={22} />
          </button>
          <span className='topbar-crumb'>
            Workspace <ChevronRight size={14} /> <b>Accident assessment</b>
          </span>
          <div className='topbar-right'>
            <span className='local-pill'>
              <span /> Local workspace
            </span>
            <span className='top-avatar'>AS</span>
          </div>
        </header>
        <main>{children}</main>
        <footer className='main-footer'>
          <span>© {new Date().getFullYear()} Accord Assessment</span>
          <span>Decision support only · Human review required</span>
        </footer>
      </div>
    </div>
  );
}

function useClaims() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    request('/api/claims')
      .then((data) => {
        if (active) setClaims(data);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  return { claims, loading, error };
}

function PageHeading({ eyebrow, title, subtitle, action }) {
  return (
    <div className='page-heading'>
      <div>
        <div className='eyebrow'>{eyebrow}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
function Notice({ children, icon: Icon = CircleHelp }) {
  return (
    <div className='notice'>
      <Icon size={18} />
      <span>{children}</span>
    </div>
  );
}
function ErrorMessage({ message }) {
  return message ? (
    <div className='error-message' role='alert'>
      {message}
    </div>
  ) : null;
}

function AnalysisResult({ result }) {
  if (!result)
    return (
      <div className='analysis-empty'>
        <span>
          <ImageIcon size={25} />
        </span>
        <b>No analysis requested yet</b>
        <p>
          Run Gemini analysis to review visible damage in the uploaded photos.
        </p>
      </div>
    );
  if (result.model_status !== 'completed')
    return (
      <div className='model-state'>
        <span className='model-symbol'>
          <CircleHelp size={24} />
        </span>
        <div>
          <b>Gemini was not configured for this run</b>
          <p>{result.message}</p>
          <small>Run analysis again after adding your API key.</small>
        </div>
      </div>
    );
  return (
    <div className='analysis-result'>
      <div className='analysis-summary'>
        <span className='analysis-kicker'>
          <Sparkles size={16} /> GEMINI VISUAL REVIEW
        </span>
        <p>{result.overall_summary}</p>
        <span className='analysis-meta'>
          {result.images_considered} photo
          {result.images_considered !== 1 ? 's' : ''} reviewed ·{' '}
          {result.review_priority || 'Human review'} priority ·{' '}
          {result.model_version}
        </span>
      </div>
      <div className='analysis-section'>
        <h3>
          Visible damage <span>{result.detections?.length || 0}</span>
        </h3>
        {result.detections?.length ? (
          <div className='finding-list'>
            {result.detections.map((finding, index) => (
              <div className='finding-item' key={index}>
                <div>
                  <b>{finding.part || 'Vehicle area'}</b>
                  <span>
                    {finding.damage_type} · {finding.severity}
                  </span>
                </div>
                <p>{finding.description}</p>
                <small>Photo {finding.image_index}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className='analysis-muted'>
            No visible damage was identified in the supplied photos. An assessor
            should still inspect them.
          </p>
        )}
      </div>
      {result.image_quality_notes?.length > 0 && (
        <div className='analysis-section'>
          <h3>Photo quality</h3>
          <ul>
            {result.image_quality_notes.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {result.uncertainties?.length > 0 && (
        <div className='analysis-section'>
          <h3>What remains uncertain</h3>
          <ul>
            {result.uncertainties.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {result.recommended_next_steps?.length > 0 && (
        <div className='analysis-section'>
          <h3>Suggested next steps</h3>
          <ul>
            {result.recommended_next_steps.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      <div className='analysis-disclaimer'>
        <ShieldCheck size={16} /> Preliminary visual observations. Verify with a
        qualified assessor before any claim decision.
      </div>
    </div>
  );
}

function ClaimTable({ claims, compact = false }) {
  if (!claims.length)
    return (
      <div className='empty-state'>
        <span>
          <FileText size={28} />
        </span>
        <h3>No claims yet</h3>
        <p>Start with a new claim to build your assessment queue.</p>
        <Link className='button primary' to='/new'>
          <Plus size={17} /> Create a claim
        </Link>
      </div>
    );
  return (
    <div className='table-scroll'>
      <table>
        <thead>
          <tr>
            <th>CLAIM</th>
            <th>VEHICLE</th>
            <th>INCIDENT DATE</th>
            <th>STATUS</th>
            <th>PHOTOS</th>
            <th>
              <span className='sr-only'>Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {claims.map((claim) => (
            <tr key={claim.id}>
              <td>
                <Link className='claim-cell' to={`/claims/${claim.id}`}>
                  <span className='claim-icon'>
                    <FileText size={19} strokeWidth={1.6} />
                  </span>
                  <span>
                    <b>{claimNumber(claim.id)}</b>
                    <small>{claim.claimant_name}</small>
                  </span>
                </Link>
              </td>
              <td>
                <b className='vehicle-name'>
                  {[claim.vehicle_make, claim.vehicle_model]
                    .filter(Boolean)
                    .join(' ') || claim.vehicle_number}
                </b>
                <small className='cell-secondary'>{claim.vehicle_number}</small>
              </td>
              <td>{formatDate(claim.incident_date)}</td>
              <td>
                <Status value={claim.status} />
              </td>
              <td>
                <span className='photo-count'>
                  <Camera size={15} /> {claim.images?.length || 0}
                </span>
              </td>
              <td>
                <Link
                  className='row-open'
                  to={`/claims/${claim.id}`}
                  aria-label={`Open ${claimNumber(claim.id)}`}
                >
                  <ArrowRight size={18} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {compact && claims.length > 5 && (
        <Link className='table-footer' to='/claims'>
          View all claims <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}

function Overview() {
  const { claims, loading, error } = useClaims();
  const pending = claims.filter((c) => c.status !== 'assessed').length;
  const reviewed = claims.filter((c) => c.status === 'assessed').length;
  return (
    <>
      <section className='hero'>
        <div className='hero-art' aria-hidden='true'>
          <div className='orbit orbit-one' />
          <div className='orbit orbit-two' />
          <div className='glow-core'>
            <Activity size={95} strokeWidth={0.8} />
          </div>
          <div className='float-card float-card-a'>
            <span>
              <Camera size={17} />
            </span>
            <span>
              Photo evidence<small>Ready to review</small>
            </span>
            <Check size={14} />
          </div>
          <div className='float-card float-card-b'>
            <Sparkles size={16} />
            <span>Preliminary analysis</span>
          </div>
        </div>
        <div className='hero-content'>
          <div className='hero-tag'>
            <span /> THE CLAIMS WORKSPACE
          </div>
          <h1>
            A clearer view of
            <br />
            <em>every claim.</em>
          </h1>
          <p>
            Bring accident details, photo evidence, and human review together in
            one calm workspace.
          </p>
          <Link to='/new' className='button primary hero-button'>
            Start a new claim <ArrowRight size={17} />
          </Link>
        </div>
        <div className='hero-bottom'>
          <span>
            <ShieldCheck size={17} /> Human-led decisions
          </span>
          <span>
            <Camera size={17} /> Evidence in one place
          </span>
          <span>
            <FileCheck2 size={17} /> Clear review trail
          </span>
        </div>
      </section>
      <section className='content-section'>
        <PageHeading
          eyebrow='WORKSPACE AT A GLANCE'
          title='Your overview'
          subtitle='A live view of claims in this workspace.'
          action={
            <Link className='button pale' to='/claims'>
              View all claims <ArrowRight size={16} />
            </Link>
          }
        />
        <div className='stats-grid'>
          <div className='stat-card'>
            <span className='stat-icon lavender'>
              <ClipboardList size={21} />
            </span>
            <span className='stat-label'>Total claims</span>
            <strong>{claims.length}</strong>
            <span className='stat-foot'>
              Submitted in this workspace <ArrowDownRight size={15} />
            </span>
          </div>
          <div className='stat-card'>
            <span className='stat-icon violet'>
              <Clock3 size={21} />
            </span>
            <span className='stat-label'>Awaiting review</span>
            <strong>{pending}</strong>
            <span className='stat-foot'>
              Need human attention <ArrowRight size={15} />
            </span>
          </div>
          <div className='stat-card'>
            <span className='stat-icon pale-icon'>
              <FileCheck2 size={21} />
            </span>
            <span className='stat-label'>Assessed</span>
            <strong>{reviewed}</strong>
            <span className='stat-foot'>
              Reviews recorded <Check size={15} />
            </span>
          </div>
        </div>
      </section>
      <section className='content-section recent-section'>
        <div className='section-title'>
          <div>
            <div className='eyebrow'>RECENT ACTIVITY</div>
            <h2>Recent claims</h2>
            <p>Pick up where your team left off.</p>
          </div>
          <Link to='/claims' className='text-link'>
            See all <ArrowRight size={17} />
          </Link>
        </div>
        <div className='table-card'>
          {loading ? (
            <div className='loading'>Loading claims…</div>
          ) : error ? (
            <ErrorMessage message={error} />
          ) : (
            <ClaimTable claims={claims.slice(0, 5)} compact />
          )}
        </div>
      </section>
      <section className='guidance-banner'>
        <span className='guidance-icon'>
          <ShieldCheck size={23} />
        </span>
        <div>
          <b>Built for informed decisions</b>
          <p>
            Image analysis is preliminary. Coverage, liability, hidden damage,
            and final costs require qualified human review.
          </p>
        </div>
        <Link to='/new' className='button ghost-light'>
          New claim <ArrowRight size={16} />
        </Link>
      </section>
    </>
  );
}

function Claims() {
  const { claims, loading, error } = useClaims();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const filtered = useMemo(
    () =>
      claims.filter(
        (c) =>
          (filter === 'all' || c.status === filter) &&
          `${c.id} ${claimNumber(c.id)} ${c.claimant_name} ${c.vehicle_number} ${c.vehicle_make || ''} ${c.vehicle_model || ''}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [claims, filter, search],
  );
  return (
    <div className='inner-page'>
      <PageHeading
        eyebrow='CLAIM MANAGEMENT'
        title='All claims'
        subtitle='Track submissions and keep every assessment moving.'
        action={
          <Link className='button primary' to='/new'>
            <Plus size={17} /> New claim
          </Link>
        }
      />
      <div className='list-toolbar'>
        <div className='search-box'>
          <Search size={19} />
          <input
            aria-label='Search claims'
            placeholder='Search by claim, name, or vehicle…'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label='Filter by status'
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value='all'>All statuses</option>
          <option value='submitted'>New submissions</option>
          <option value='under_review'>In review</option>
          <option value='needs_more_info'>Needs information</option>
          <option value='assessed'>Assessed</option>
        </select>
      </div>
      <div className='table-card'>
        {loading ? (
          <div className='loading'>Loading claims…</div>
        ) : error ? (
          <ErrorMessage message={error} />
        ) : filtered.length ? (
          <ClaimTable claims={filtered} />
        ) : claims.length ? (
          <div className='empty-state'>
            <Search size={26} />
            <h3>No matching claims</h3>
            <p>Try a different search or status.</p>
          </div>
        ) : (
          <ClaimTable claims={[]} />
        )}
      </div>
      <p className='below-table'>
        Showing {filtered.length} of {claims.length} claims
      </p>
    </div>
  );
}

const initialForm = {
  claimant_name: '',
  email: '',
  vehicle_number: '',
  vehicle_make: '',
  vehicle_model: '',
  vehicle_year: '',
  incident_date: '',
  incident_description: '',
};
function NewClaim() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState('');
  const [createdId, setCreatedId] = useState(null);
  const [uploadedCount, setUploadedCount] = useState(0);
  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const chooseFiles = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 8) {
      setError('Choose no more than 8 photos.');
      setFiles([]);
      return;
    }
    if (
      selected.some(
        (f) =>
          !['image/jpeg', 'image/png', 'image/webp'].includes(f.type) ||
          f.size > 10 * 1024 * 1024,
      )
    ) {
      setError('Photos must be JPEG, PNG, or WEBP and under 10 MB each.');
      setFiles([]);
      return;
    }
    setError('');
    setFiles(selected);
  };
  async function submit(e) {
    e.preventDefault();
    if (!files.length) {
      setError('Add at least one vehicle photo.');
      return;
    }
    setBusy(true);
    setError('');
    let id = createdId;
    try {
      if (!id) {
        const claim = await request('/api/claims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            vehicle_year: form.vehicle_year ? Number(form.vehicle_year) : null,
            vehicle_make: form.vehicle_make || null,
            vehicle_model: form.vehicle_model || null,
          }),
        });
        id = claim.id;
        setCreatedId(id);
      }
      for (let i = uploadedCount; i < files.length; i++) {
        setUploadProgress(`Uploading photo ${i + 1} of ${files.length}…`);
        const body = new FormData();
        body.append('file', files[i]);
        await request(`/api/claims/${id}/images`, { method: 'POST', body });
        setUploadedCount(i + 1);
      }
      navigate(`/claims/${id}`);
    } catch (err) {
      setError(
        `${err.message}${id ? ` Claim ${claimNumber(id)} was saved; you can open it from All claims.` : ''}`,
      );
    } finally {
      setBusy(false);
      setUploadProgress('');
    }
  }
  return (
    <div className='inner-page form-page'>
      <Link className='back-link' to='/claims'>
        <ArrowLeft size={16} /> Back to claims
      </Link>
      <PageHeading
        eyebrow='NEW SUBMISSION'
        title='Start a new claim'
        subtitle='Capture the incident once, then add the photos that tell the story.'
      />
      <div className='form-layout'>
        <form onSubmit={submit} className='claim-form'>
          <div className='form-card'>
            <div className='form-card-title'>
              <span className='step-number'>01</span>
              <div>
                <h2>Claimant details</h2>
                <p>Who should we associate with this claim?</p>
              </div>
            </div>
            <div className='form-grid'>
              <label>
                Full name <span>*</span>
                <input
                  name='claimant_name'
                  value={form.claimant_name}
                  onChange={update}
                  placeholder='e.g. Anika Sharma'
                  minLength='2'
                  maxLength='120'
                  required
                />
              </label>
              <label>
                Email address <span>*</span>
                <input
                  name='email'
                  type='email'
                  value={form.email}
                  onChange={update}
                  placeholder='anika@example.com'
                  required
                />
              </label>
            </div>
          </div>
          <div className='form-card'>
            <div className='form-card-title'>
              <span className='step-number'>02</span>
              <div>
                <h2>Vehicle & incident</h2>
                <p>Provide the basics about the vehicle and what happened.</p>
              </div>
            </div>
            <div className='form-grid'>
              <label>
                Registration number <span>*</span>
                <input
                  name='vehicle_number'
                  value={form.vehicle_number}
                  onChange={update}
                  placeholder='e.g. MH 02 AB 1234'
                  minLength='4'
                  maxLength='30'
                  required
                />
              </label>
              <label>
                Incident date <span>*</span>
                <input
                  name='incident_date'
                  type='date'
                  max={new Date().toLocaleDateString('en-CA')}
                  value={form.incident_date}
                  onChange={update}
                  required
                />
              </label>
              <label>
                Vehicle make
                <input
                  name='vehicle_make'
                  value={form.vehicle_make}
                  onChange={update}
                  placeholder='e.g. Hyundai'
                  maxLength='80'
                />
              </label>
              <label>
                Vehicle model
                <input
                  name='vehicle_model'
                  value={form.vehicle_model}
                  onChange={update}
                  placeholder='e.g. i20'
                  maxLength='80'
                />
              </label>
              <label>
                Model year
                <input
                  name='vehicle_year'
                  type='number'
                  min='1950'
                  max='2100'
                  value={form.vehicle_year}
                  onChange={update}
                  placeholder='e.g. 2022'
                />
              </label>
              <label className='span-two'>
                What happened? <span>*</span>
                <textarea
                  name='incident_description'
                  value={form.incident_description}
                  onChange={update}
                  placeholder='Describe the incident and the visible areas of damage…'
                  minLength='10'
                  maxLength='3000'
                  required
                />
              </label>
            </div>
          </div>
          <div className='form-card'>
            <div className='form-card-title'>
              <span className='step-number'>03</span>
              <div>
                <h2>Photo evidence</h2>
                <p>Add clear views of the vehicle and affected areas.</p>
              </div>
            </div>
            <label className='upload-zone'>
              <input
                type='file'
                accept='image/jpeg,image/png,image/webp'
                multiple
                onChange={chooseFiles}
              />
              <span className='upload-icon'>
                <CloudUpload size={28} />
              </span>
              <b>Choose photos to upload</b>
              <small>JPEG, PNG or WEBP · up to 8 photos · 10 MB each</small>
            </label>
            {files.length > 0 && (
              <div className='selected-files'>
                {files.map((f, i) => (
                  <span key={`${f.name}-${i}`}>
                    <ImageIcon size={16} />
                    {f.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <ErrorMessage message={error} />
          <div className='form-actions'>
            <span>
              <ShieldCheck size={17} /> Preliminary assessment · Human review
              required
            </span>
            <button className='button primary' disabled={busy}>
              {busy ? (
                uploadProgress || 'Saving claim…'
              ) : (
                <>
                  Submit claim <ArrowRight size={17} />
                </>
              )}
            </button>
          </div>
        </form>
        <aside className='form-aside'>
          <div className='aside-card'>
            <span className='aside-icon'>
              <Sparkles size={21} />
            </span>
            <h3>What happens next?</h3>
            <div className='timeline'>
              <div>
                <span>1</span>
                <p>
                  <b>Submit the details</b>
                  <small>We save your incident and vehicle information.</small>
                </p>
              </div>
              <div>
                <span>2</span>
                <p>
                  <b>Review the photos</b>
                  <small>An assessor examines the uploaded evidence.</small>
                </p>
              </div>
              <div>
                <span>3</span>
                <p>
                  <b>Record an assessment</b>
                  <small>Findings and next steps are documented.</small>
                </p>
              </div>
            </div>
          </div>
          <div className='aside-note'>
            <CircleHelp size={19} />
            <p>
              Images alone cannot establish hidden damage, liability, coverage,
              or a final repair cost.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Detail() {
  const { id } = useParams();
  const [claim, setClaim] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [notes, setNotes] = useState('');
  const [decision, setDecision] = useState('under_review');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [lightbox, setLightbox] = useState(null);
  async function refresh() {
    const [c, a] = await Promise.all([
      request(`/api/claims/${id}`),
      request(`/api/claims/${id}/assessment`),
    ]);
    setClaim(c);
    setAssessment(a);
    setNotes(a.reviewer_notes || '');
    setDecision(c.status === 'submitted' ? 'under_review' : c.status);
  }
  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, [id]);
  async function analyze() {
    setBusy('analyze');
    setError('');
    setMessage('');
    try {
      const result = await request(`/api/claims/${id}/analyze`, {
        method: 'POST',
      });
      await refresh();
      setMessage(result.analysis.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }
  async function saveReview(e) {
    e.preventDefault();
    setBusy('review');
    setError('');
    setMessage('');
    try {
      await request(`/api/claims/${id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewer_notes: notes, decision }),
      });
      await refresh();
      setMessage('Review saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }
  if (error && !claim)
    return (
      <div className='inner-page'>
        <Link className='back-link' to='/claims'>
          <ArrowLeft size={16} /> Back to claims
        </Link>
        <ErrorMessage message={error} />
      </div>
    );
  if (!claim) return <div className='inner-page loading'>Loading claim…</div>;
  const result = assessment?.findings?.analysis;
  return (
    <div className='inner-page detail-page'>
      <Link className='back-link' to='/claims'>
        <ArrowLeft size={16} /> Back to claims
      </Link>
      <div className='detail-heading'>
        <div>
          <div className='eyebrow'>
            CLAIM DETAILS <span> / {claimNumber(claim.id)}</span>
          </div>
          <h1>{claimNumber(claim.id)}</h1>
          <p>
            Submitted {formatDate(claim.created_at)} · {claim.claimant_name}
          </p>
        </div>
        <Status value={claim.status} />
      </div>
      <Notice icon={ShieldCheck}>
        This workspace supports assessment. All image findings are preliminary
        and require human verification.
      </Notice>
      <ErrorMessage message={error} />
      {message && (
        <div className='success-message' role='status'>
          <Check size={17} />
          {message}
        </div>
      )}
      <div className='detail-grid'>
        <div className='detail-main'>
          <section className='detail-card'>
            <div className='card-heading'>
              <span className='card-heading-icon'>
                <FileText size={20} />
              </span>
              <div>
                <h2>Incident details</h2>
                <p>Information provided with the claim</p>
              </div>
            </div>
            <div className='data-grid'>
              <div>
                <span>CLAIMANT</span>
                <b>{claim.claimant_name}</b>
              </div>
              <div>
                <span>EMAIL</span>
                <b>{claim.email}</b>
              </div>
              <div>
                <span>VEHICLE</span>
                <b>
                  {[claim.vehicle_make, claim.vehicle_model]
                    .filter(Boolean)
                    .join(' ') || 'Not specified'}
                  {claim.vehicle_year ? ` · ${claim.vehicle_year}` : ''}
                </b>
              </div>
              <div>
                <span>REGISTRATION</span>
                <b>{claim.vehicle_number}</b>
              </div>
              <div>
                <span>INCIDENT DATE</span>
                <b>{formatDate(claim.incident_date)}</b>
              </div>
            </div>
            <div className='description-block'>
              <span>INCIDENT DESCRIPTION</span>
              <p>{claim.incident_description}</p>
            </div>
          </section>
          <section className='detail-card'>
            <div className='card-heading'>
              <span className='card-heading-icon'>
                <Camera size={20} />
              </span>
              <div>
                <h2>Photo evidence</h2>
                <p>
                  {claim.images.length} photo
                  {claim.images.length !== 1 ? 's' : ''} attached to this claim
                </p>
              </div>
            </div>
            {claim.images.length ? (
              <div className='photo-grid'>
                {claim.images.map((image) => (
                  <button
                    key={image.id}
                    className='photo-tile'
                    onClick={() => setLightbox(image)}
                    aria-label={`View ${image.original_name}`}
                  >
                    <img
                      src={imageUrl(claim.id, image.id)}
                      alt={image.original_name}
                    />
                    <span>{image.original_name}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className='muted'>No photographs uploaded.</p>
            )}
          </section>
          <section className='detail-card assessment-card'>
            <div className='card-heading'>
              <span className='card-heading-icon'>
                <Sparkles size={20} />
              </span>
              <div>
                <h2>Image assessment</h2>
                <p>Preliminary Gemini visual review</p>
              </div>
            </div>
            <AnalysisResult result={result} />
            <div className='assessment-actions'>
              <button
                className='button pale'
                onClick={analyze}
                disabled={busy !== '' || !claim.images.length}
              >
                <Sparkles size={17} />{' '}
                {busy === 'analyze'
                  ? 'Checking…'
                  : result
                    ? 'Run again'
                    : 'Run Gemini analysis'}
              </button>
              {!claim.images.length && (
                <small>Add a photo before running analysis.</small>
              )}
            </div>
            <p className='provider-note'>
              Running analysis sends resized copies of the photos to the
              configured Gemini API.
            </p>
            <div className='estimate-note'>
              <CircleHelp size={17} />
              <span>
                Repair costs are unavailable until verified regional pricing
                data is configured.
              </span>
            </div>
          </section>
        </div>
        <aside className='detail-aside'>
          <section className='review-card'>
            <div className='card-heading'>
              <span className='card-heading-icon'>
                <FileCheck2 size={20} />
              </span>
              <div>
                <h2>Assessor review</h2>
                <p>Record your observations</p>
              </div>
            </div>
            <form onSubmit={saveReview}>
              <label>
                Review status
                <select
                  value={decision}
                  onChange={(e) => setDecision(e.target.value)}
                >
                  <option value='under_review'>In review</option>
                  <option value='needs_more_info'>Needs information</option>
                  <option value='assessed'>Assessed</option>
                </select>
              </label>
              <label>
                Reviewer notes
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder='Record verified observations, missing evidence, and next steps…'
                  minLength='1'
                  maxLength='5000'
                  required
                />
              </label>
              <button
                className='button primary'
                disabled={busy !== '' || !notes.trim()}
              >
                {busy === 'review' ? 'Saving…' : 'Save review'}{' '}
                <ArrowRight size={16} />
              </button>
            </form>
            {assessment?.reviewed_at && (
              <div className='reviewed-time'>
                <Check size={15} /> Last reviewed{' '}
                {formatDate(assessment.reviewed_at)}
              </div>
            )}
          </section>
          <div className='aside-note'>
            <ShieldCheck size={19} />
            <p>
              Do not approve or reject a claim solely on an image analysis
              result.
            </p>
          </div>
        </aside>
      </div>
      {lightbox && (
        <div
          className='lightbox'
          role='dialog'
          aria-modal='true'
          aria-label={lightbox.original_name}
          onClick={() => setLightbox(null)}
        >
          <button onClick={() => setLightbox(null)} aria-label='Close image'>
            <X size={24} />
          </button>
          <img
            src={imageUrl(claim.id, lightbox.id)}
            alt={lightbox.original_name}
            onClick={(e) => e.stopPropagation()}
          />
          <span>{lightbox.original_name}</span>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path='/' element={<Overview />} />
        <Route path='/claims' element={<Claims />} />
        <Route path='/new' element={<NewClaim />} />
        <Route path='/claims/:id' element={<Detail />} />
        <Route
          path='*'
          element={
            <div className='inner-page empty-state'>
              <h1>Page not found</h1>
              <Link className='button primary' to='/'>
                Return to overview
              </Link>
            </div>
          }
        />
      </Routes>
    </Shell>
  );
}
