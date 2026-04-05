import { Router } from './components/Router.js';
import { Navbar } from './components/Navbar.js';
import { Home } from './components/pages/Home.js';
import { Upload } from './components/pages/Upload.js';
import { Admin } from './components/pages/Admin.js';
import { Dataset } from './components/pages/Dataset.js';

const routes = {
    '/': Home,
    '/upload': Upload,
    '/admin': Admin,
    '/dataset': Dataset,
};

const app = document.getElementById('app');
const navbar = Navbar();
const content = document.createElement('main');
content.id = 'content';

app.appendChild(navbar);
app.appendChild(content);

const router = Router(routes, content);
router.start();
