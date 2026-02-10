import '@testing-library/jest-dom';
import { JSDOM } from 'jsdom';

// Ensure a jsdom-like environment in case Vitest didn't set it up
const dom = new JSDOM('<!doctype html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.SVGElement = dom.window.SVGElement;
