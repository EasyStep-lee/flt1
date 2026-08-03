import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const immutableCommitPattern = /^[0-9a-f]{40}$/iu;
const zeroCommitPattern = /^0{40}$/u;
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

const requireCommitSha = (value, errorCode) => {
  const candidate = String(value ?? '').trim();
  if (!immutableCommitPattern.test(candidate)) throw new Error(errorCode);
  return candidate.toLowerCase();
};

export const selectCiBaseCandidate = ({
  eventName,
  pullRequestBaseSha,
  pushBeforeSha,
}) => {
  if (eventName === 'pull_request') {
    return requireCommitSha(pullRequestBaseSha, 'CI_PULL_REQUEST_BASE_SHA_REQUIRED');
  }
  if (eventName === 'push') {
    const candidate = requireCommitSha(
      pushBeforeSha,
      'CI_PUSH_BEFORE_SHA_REQUIRED',
    );
    if (zeroCommitPattern.test(candidate)) {
      throw new Error('CI_BASE_REF_INITIAL_PUSH_UNSUPPORTED');
    }
    return candidate;
  }
  if (eventName === 'workflow_dispatch') return null;
  throw new Error(`CI_EVENT_UNSUPPORTED:${eventName ?? '<missing>'}`);
};

const runGit = (arguments_) => {
  const result = spawnSync('git', arguments_, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`CI_BASE_REF_GIT_FAILED:${arguments_.join(' ')}`);
  }
  return result.stdout.trim();
};

const main = () => {
  const selected = selectCiBaseCandidate({
    eventName: process.env.GITHUB_EVENT_NAME,
    pullRequestBaseSha: process.env.PULL_REQUEST_BASE_SHA,
    pushBeforeSha: process.env.PUSH_BEFORE_SHA,
  });
  const candidate = selected ?? runGit(['rev-parse', 'HEAD^']);
  const resolved = runGit(['rev-parse', '--verify', `${candidate}^{commit}`]);
  const immutable = requireCommitSha(resolved, 'CI_BASE_REF_NOT_IMMUTABLE');
  process.stdout.write(`sha=${immutable}\n`);
};

const modulePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(modulePath)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'CI_BASE_REF_RESOLUTION_FAILED'}\n`,
    );
    process.exitCode = 1;
  }
}
