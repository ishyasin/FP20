// FP10 Manager 2 by ED&G™ — shared client
// Load after the Supabase CDN script on every page.

const APP_VERSION = '2.1.1';
const SUPABASE_URL = 'https://crohdbiuynltviecqepa.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_tdUjUZYRF8m-kLK8EnNDbA_i4Ri07sh';
const LOGIN_EMAIL_DOMAIN = 'users.edandg.com';
const SUPPORT_EMAIL = 'support@edandg.com';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const GENERIC_LOGIN_ERROR = 'Incorrect User ID or Passcode.';

function normaliseUserId(userId) {
  return String(userId || '').trim().toLowerCase();
}

// Signs in with User ID + Passcode. The same message is shown for an
// unknown ID or a wrong passcode so the screen can't be used to discover IDs.
async function signInWithUserId(userId, passcode) {
  const id = normaliseUserId(userId);
  if (!/^[a-z0-9._-]{3,32}$/.test(id) || !passcode) throw new Error(GENERIC_LOGIN_ERROR);

  const { error } = await supabaseClient.auth.signInWithPassword({
    email: `${id}@${LOGIN_EMAIL_DOMAIN}`,
    password: passcode,
  });
  if (error) throw new Error(GENERIC_LOGIN_ERROR);

  const me = await getMe();
  if (!me || !me.isActive) {
    await supabaseClient.auth.signOut();
    throw new Error('This account is suspended. Contact your administrator.');
  }
  return me;
}

// Current user's profile and trust (with a signed logo URL), or null.
async function getMe() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return null;

  const [{ data: profile }, { data: isActive }] = await Promise.all([
    supabaseClient
      .from('profiles')
      .select('id, user_id, first_name, last_name, role, trust_id, active, must_reset_password')
      .eq('id', session.user.id)
      .single(),
    supabaseClient.rpc('is_active_account'),
  ]);
  if (!profile) return null;

  let trust = null;
  if (profile.trust_id) {
    const { data: t } = await supabaseClient.from('trusts').select('id, name, logo_path').eq('id', profile.trust_id).single();
    if (t) {
      let logoUrl = null;
      if (t.logo_path) {
        const { data: signed } = await supabaseClient.storage.from('trust-logos').createSignedUrl(t.logo_path, 3600);
        logoUrl = signed?.signedUrl || null;
      }
      trust = { id: t.id, name: t.name, logoUrl };
    }
  }

  return {
    ...profile,
    fullName: `${profile.first_name} ${profile.last_name}`.trim(),
    isAdmin: profile.role === 'admin',
    isActive: isActive === true,
    trust,
  };
}

// Gate for every protected page. `role` is 'user' or 'admin'. Redirects
// away if signed out, suspended, mid passcode reset, or on the wrong page
// for the account type. Resolves with the current user.
async function requirePage(role) {
  const me = await getMe();
  const here = window.location.pathname.split('/').pop() || 'index.html';

  if (!me) { window.location.replace('login.html'); return new Promise(() => {}); }
  if (!me.isActive) { await signOut(); return new Promise(() => {}); }
  if (me.must_reset_password && here !== 'reset-password.html') {
    window.location.replace('reset-password.html');
    return new Promise(() => {});
  }
  if (role === 'admin' && !me.isAdmin) { window.location.replace('index.html'); return new Promise(() => {}); }
  if (role === 'user' && me.isAdmin) { window.location.replace('admin.html'); return new Promise(() => {}); }
  return me;
}

async function setMyPasscode(newPasscode) {
  const { error } = await supabaseClient.auth.updateUser({ password: newPasscode });
  if (error) throw new Error(error.message);
  const { error: rpcError } = await supabaseClient.rpc('clear_must_reset_password');
  if (rpcError) throw new Error(rpcError.message);
}

async function callFunction(functionName, action, payload = {}) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) throw new Error('Your session has expired. Please sign in again.');

  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  let body = {};
  try { body = await res.json(); } catch { /* non-JSON error page */ }
  if (res.status === 401) {
    await signOut();
    throw new Error('Your session has expired. Please sign in again.');
  }
  if (!res.ok) throw new Error(body.error || 'Something went wrong processing that request.');
  return body;
}

const callFp10Logic = (action, payload) => callFunction('fp10-logic', action, payload);
const callAdmin = (action, payload) => callFunction('admin', action, payload);

async function signOut() {
  try { await supabaseClient.auth.signOut(); } catch { /* still redirect */ }
  try {
    const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
    localStorage.removeItem(`sb-${ref}-auth-token`);
  } catch { /* ignore */ }
  window.location.replace('login.html');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatDateGB(d = new Date()) {
  return new Date(d).toLocaleDateString('en-GB');
}

function formatDateTimeGB(d = new Date()) {
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Fills any <footer data-app-footer> with the standard footer.
function renderAppFooter() {
  document.querySelectorAll('[data-app-footer]').forEach((el) => {
    el.innerHTML = `
      <span>FP10 Manager 2 by <strong>ED&amp;G™</strong></span>
      <span class="dot">·</span>
      <span>v${APP_VERSION}</span>
      <span class="dot">·</span>
      <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>
      <span class="dot">·</span>
      <a href="user-notice.html">User notice</a>`;
  });
}

document.addEventListener('DOMContentLoaded', renderAppFooter);
