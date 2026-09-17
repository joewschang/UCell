// Browser test harness: real App and provider, intercepted local API, no LIFF bootstrap.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {QualificationProvider} from '../src/QualificationContext';
import App from '../src/App';
import '../src/styles.css';
import '@ucell/design-system/styles';
import '../src/ucell-theme.css';
createRoot(document.getElementById('root')!).render(<MemoryRouter><QualificationProvider><App/></QualificationProvider></MemoryRouter>);
