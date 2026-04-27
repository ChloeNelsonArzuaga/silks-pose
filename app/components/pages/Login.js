import { supabase } from '../../lib/supabase.js';

export function Login() {
    const page = document.createElement('div');
    page.className = 'login-page';

    page.innerHTML = `
        <div class="login-card">
            <div class="login-brand">
                <div class="login-brand-icon">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                        <path d="M16 4 C10 4 6 9 8 14 C10 19 8 24 16 28 C24 24 22 19 24 14 C26 9 22 4 16 4Z" stroke="#5c4ec9" stroke-width="1.5" fill="none"/>
                        <path d="M16 4 C16 10 20 14 16 28" stroke="#5c4ec9" stroke-width="1.2" fill="none"/>
                    </svg>
                </div>
                <div>
                    <div class="login-brand-name">SilkVault</div>
                    <div class="login-brand-tagline">YOUR AERIAL JOURNEY, SAVED.</div>
                </div>
            </div>

            <div class="login-tabs">
                <button class="login-tab login-tab-active" data-tab="signin">Sign in</button>
                <button class="login-tab" data-tab="signup">Sign up</button>
            </div>

            <form class="login-form" id="login-form" autocomplete="on">
                <div class="login-field">
                    <label class="login-label" for="login-email">Email</label>
                    <input class="login-input" type="email" id="login-email" name="email" placeholder="you@example.com" required autocomplete="email">
                </div>
                <div class="login-field">
                    <label class="login-label" for="login-password">Password</label>
                    <input class="login-input" type="password" id="login-password" name="password" placeholder="••••••••" required autocomplete="current-password" minlength="6">
                </div>
                <div class="login-error" id="login-error" hidden></div>
                <button class="login-submit" type="submit" id="login-submit">Sign in</button>
            </form>

            <div class="login-confirm" id="login-confirm" hidden>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#5c4ec9" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <p>Check your email for a confirmation link.</p>
            </div>
        </div>
    `;

    let mode = 'signin';

    const form = page.querySelector('#login-form');
    const submitBtn = page.querySelector('#login-submit');
    const errorEl = page.querySelector('#login-error');
    const confirmEl = page.querySelector('#login-confirm');
    const passwordInput = page.querySelector('#login-password');

    page.querySelectorAll('.login-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            mode = tab.dataset.tab;
            page.querySelectorAll('.login-tab').forEach(t => t.classList.toggle('login-tab-active', t.dataset.tab === mode));
            submitBtn.textContent = mode === 'signin' ? 'Sign in' : 'Create account';
            passwordInput.autocomplete = mode === 'signin' ? 'current-password' : 'new-password';
            errorEl.hidden = true;
        });
    });

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const email = page.querySelector('#login-email').value.trim();
        const password = page.querySelector('#login-password').value;

        submitBtn.disabled = true;
        submitBtn.textContent = mode === 'signin' ? 'Signing in…' : 'Creating account…';
        errorEl.hidden = true;

        let error;
        if (mode === 'signin') {
            ({ error } = await supabase.auth.signInWithPassword({ email, password }));
        } else {
            const { error: signUpError } = await supabase.auth.signUp({ email, password });
            error = signUpError;
            if (!error) {
                form.hidden = true;
                confirmEl.hidden = false;
                return;
            }
        }

        if (error) {
            errorEl.textContent = error.message;
            errorEl.hidden = false;
            submitBtn.disabled = false;
            submitBtn.textContent = mode === 'signin' ? 'Sign in' : 'Create account';
        }
    });

    return page;
}
