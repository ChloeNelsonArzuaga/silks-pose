import { supabase } from './lib/supabase.js';
import { Router } from './components/Router.js';
import { Navbar } from './components/Navbar.js';
import { Home } from './components/pages/Home.js';
import { Admin } from './components/pages/Admin.js';
import { Dataset } from './components/pages/Dataset.js';
import { Collections } from './components/pages/Collections.js';
import { Progress } from './components/pages/Progress.js';
import { Favorites } from './components/pages/Favorites.js';
import { Live } from './components/pages/Live.js';
import { Login } from './components/pages/Login.js';

const routes = {
    '/': Home,
    '/admin': Admin,
    '/dataset': Dataset,
    '/collections': Collections,
    '/progress': Progress,
    '/favorites': Favorites,
    '/live': Live,
};

const app = document.getElementById('app');

function mountApp(session) {
    app.innerHTML = '';
    const navbar = Navbar(session);
    const content = document.createElement('main');
    content.id = 'content';
    app.appendChild(navbar);
    app.appendChild(content);
    const router = Router(routes, content);
    router.start();
}

function mountLogin() {
    app.innerHTML = '';
    app.appendChild(Login());
}

// Boot
const { data: { session } } = await supabase.auth.getSession();
if (session) {
    mountApp(session);
} else {
    mountLogin();
}

// React to sign-in / sign-out
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') mountApp(session);
    if (event === 'SIGNED_OUT') mountLogin();
});
