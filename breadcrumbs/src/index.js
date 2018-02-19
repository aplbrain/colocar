import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import registerServiceWorker from './registerServiceWorker';


window.keycloak = window.Keycloak({
    url: "https://auth.theboss.io/auth",
    realm: "BOSS",
    clientId: "endpoint"
});
window.keycloak.init({
    onLoad: 'login-required',
}).success(function (authenticated) {
    ReactDOM.render(<App />, document.getElementById('root'));
    registerServiceWorker();
    console.log(authenticated ? 'authenticated' : 'not authenticated');
}).error(function () {
    console.error('failed to initialize');
});


