import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import AppContainer from './AppContainer';
import registerServiceWorker from './registerServiceWorker';

window._appversion = "2.0.0";

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
    window.keycloak.loadUserProfile().success(() => {
        ReactDOM.render( <AppContainer /> , document.getElementById('root'));
        registerServiceWorker();
        console.log(authenticated ? 'Successfully authenticated.' : 'Not authenticated.');
    });

}).error(function () {
    console.error('Failed to initialize.');
});
