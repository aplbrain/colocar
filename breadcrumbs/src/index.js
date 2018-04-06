import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import registerServiceWorker from './registerServiceWorker';


// Inline hack to get keycloak to load before any other JS associated with
// the React app:
window.keycloak = window.Keycloak({
    url: "https://auth.theboss.io/auth",
    realm: "BOSS",
    clientId: "endpoint"
});
// Require a user sign-in:
window.keycloak.init({
    onLoad: 'login-required',
}).success(function (authenticated) {
    // Render the React app:
    ReactDOM.render(<App />, document.getElementById('root'));
    registerServiceWorker();
    console.log(authenticated ? 'authenticated' : 'not authenticated');
}).error(function () {
    console.error('failed to initialize');
});


