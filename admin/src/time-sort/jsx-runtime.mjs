import {jsx as originalJsx,jsxs as originalJsxs,Fragment} from 'react/jsx-runtime';
import {timeViews} from './runtime.mjs';
export {Fragment};
export const jsx=timeViews.wrap(originalJsx),jsxs=timeViews.wrap(originalJsxs);
