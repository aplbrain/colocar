import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import Log from "colocorazon/dist/log";
import AppContainer from './AppContainer';
import registerServiceWorker from './registerServiceWorker';


window._appversion = "1.0.0";

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
}).success(function () {
    // Render the React app:
    window.keycloak.loadUserProfile().success(() => {
        ReactDOM.render( <AppContainer /> , document.getElementById('root'));
        registerServiceWorker();
    });

}).error(function () {
    Log.error('Failed to initialize.');
});
