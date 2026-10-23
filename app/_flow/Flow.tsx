'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError, createJob, hasAccess, rerunJob, type Problem } from '@/src/ui/api';
import { errorRoute } from '@/src/ui/flow';
import { Compose, type ComposeStep } from './Compose';
import { Gate } from './Gate';
import { Mark } from './Logo';
import { JobView } from './JobView';
import type { Photo } from './photos';
import { useJob } from './useJob';
import s from './flow.module.css';

/** The job id lives in the URL (?job=), so "this link brings you back" is true on any device. */
function setJobInUrl(id: string | null) {
  window.history.pushState(null, '', id ? `?job=${encodeURIComponent(id)}` : window.location.pathname);
}

export function Flow() {
  const jobId = useSearchParams().get('job');
  const [access, setAccess] = useState<boolean | null>(null);
  const [step, setStep] = useState<ComposeStep>('moment');
  const [template, setTemplate] = useState<Photo | null>(null);
  const [users, setUsers] = useState<Photo[]>([]);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rerunning, setRerunning] = useState<Problem | null>(null);
  const [rerunError, setRerunError] = useState<string | null>(null);
  const [polls, setPolls] = useState(0);

  useEffect(() => {
    hasAccess().then(setAccess, () => setAccess(false));
  }, []);

  // Any 401 means the session ran out: back to the code screen, keeping whatever is on screen.
  const lostAccess = (err: unknown) => {
    if (err instanceof ApiError && err.code !== 'NOT_FOUND' && err.code !== 'NETWORK' && errorRoute(err.code) === 'gate') {
      setAccess(false);
      return true;
    }
    return false;
  };
  const { job, error: jobError, seen } = useJob(access ? jobId : null, polls, lostAccess);
  // An upload refused for a missing session also sends the user to the code screen.
  const watchAuth = (p: Photo | null) => {
    if (p?.status === 'bad' && /access code/i.test(p.reason ?? '')) setAccess(false);
  };

  async function start(paths?: { template: string; users: string[] }) {
    const t = paths?.template ?? template?.path;
    const u = paths?.users ?? users.filter((x) => x.status === 'ready').flatMap((x) => (x.path ? [x.path] : []));
    if (!t || !u.length) return;
    setStarting(true);
    setStartError(null);
    try {
      const { jobId: id } = await createJob(t, u);
      setJobInUrl(id);
    } catch (err) {
      if (!lostAccess(err)) setStartError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setStarting(false);
    }
  }

  async function rerun(problem: Problem) {
    if (!jobId) return;
    setRerunning(problem);
    setRerunError(null);
    try {
      const { jobId: id } = await rerunJob(jobId, problem);
      setJobInUrl(id);
      window.scrollTo({ top: 0 });
    } catch (err) {
      if (!lostAccess(err)) setRerunError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setRerunning(null);
    }
  }

  function startOver() {
    setTemplate(null);
    setUsers([]);
    setStep('moment');
    setNotice(null);
    setStartError(null);
    setJobInUrl(null);
  }

  function fix(to: 'moment' | 'you') {
    const message = job?.error?.message ?? null;
    setJobInUrl(null);
    setNotice(message);
    // Photos from another device are not in this browser; start from the first step then.
    setStep(template ? to : 'moment');
    if (to === 'moment') setTemplate(null);
  }

  if (access === null)
    return (
      <div className={s.loading} aria-busy="true">
        <Mark size={56} mode="loading" />
      </div>
    );
  if (!access)
    return (
      <div className={s.shell}>
        <Gate
          onOpen={() => {
            setAccess(true);
            setPolls((n) => n + 1);
          }}
        />
      </div>
    );

  if (jobId) {
    const readyUsers = users.filter((u) => u.path);
    return (
      <div className={s.shell} key={jobId}>
        <JobView
          job={job}
          seen={seen}
          loadError={jobError && jobError.code !== 'NETWORK' ? jobError.message : null}
          local={{ template, users: readyUsers }}
          onStartOver={startOver}
          onFix={fix}
          onRetry={template?.path && readyUsers.length ? () => void start() : null}
          onRerun={rerun}
          rerunning={rerunning}
          rerunError={rerunError}
        />
      </div>
    );
  }

  return (
    <div className={s.shell}>
      <Compose
        step={step}
        template={template}
        users={users}
        setTemplate={(p) => {
          watchAuth(p);
          setTemplate(p);
          setNotice(null);
        }}
        setUsers={(fn) => {
          setUsers(fn);
          setNotice(null);
        }}
        go={(to) => {
          setStep(to);
          window.scrollTo({ top: 0 });
        }}
        watch={watchAuth}
        onStart={() => void start()}
        starting={starting}
        startError={startError}
        notice={notice}
      />
    </div>
  );
}
