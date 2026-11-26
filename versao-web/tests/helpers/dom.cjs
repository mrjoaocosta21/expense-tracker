"use strict";

// This is a deliberately bounded DOM fixture, not a browser or a CSS/layout engine.
// It parses the real HTML and implements only DOM/event behavior used by app.js.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { randomUUID } = require("node:crypto");

class FixtureEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = options.bubbles ?? false;
    this.cancelable = options.cancelable ?? false;
    this.defaultPrevented = false;
    Object.assign(this, options);
  }
  preventDefault() { if (this.cancelable) this.defaultPrevented = true; }
  stopPropagation() { this.propagationStopped = true; }
}

function dataName(name) { return name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()); }
function decode(text) {
  return text.replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, (entity) => ({
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&nbsp;": "\u00a0"
  })[entity]);
}

class FixtureElement {
  constructor(tag, document) {
    this.tagName = tag.toUpperCase();
    this.ownerDocument = document;
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.dataset = {};
    this.listeners = new Map();
    this.style = { setProperty(name, value) { this[name] = value; } };
    this.className = "";
    this.hidden = false;
    this.disabled = false;
    this.validity = { badInput: false };
    this._value = "";
    this._valueSet = false;
    this.defaultValue = "";
    this.defaultChecked = false;
    this._checked = false;
    this._text = "";
    this.open = false;
    const element = this;
    this.classList = {
      contains(value) { return element.className.split(/\s+/).includes(value); },
      add(...values) { element.className = [...new Set([...element.className.split(/\s+/).filter(Boolean), ...values])].join(" "); },
      remove(...values) { element.className = element.className.split(/\s+/).filter((value) => !values.includes(value)).join(" "); },
      toggle(value, force) {
        const add = force === undefined ? !this.contains(value) : force;
        if (add) this.add(value); else this.remove(value);
        return add;
      }
    };
  }
  get id() { return this.attributes.get("id") || ""; }
  set id(value) { this.attributes.set("id", value); }
  get textContent() { return this._text + this.children.map((child) => child.textContent).join(""); }
  set textContent(value) {
    this.replaceChildren();
    this._text = String(value);
  }
  get childElementCount() { return this.children.filter((child) => child.tagName !== "#TEXT").length; }
  get isConnected() {
    let node = this;
    while (node) {
      if (node === this.ownerDocument) return true;
      node = node.parentNode;
    }
    return false;
  }
  get value() {
    if (this.tagName === "SELECT" && !this._valueSet) return this.children.find((child) => child.tagName === "OPTION")?.value || "";
    return this._value;
  }
  set value(value) { this._value = String(value); this._valueSet = true; }
  get checked() { return this._checked; }
  set checked(value) {
    if (value && this.type === "radio" && this.name) {
      for (const radio of this.ownerDocument.querySelectorAll('input[type="radio"]')) {
        if (radio !== this && radio.name === this.name) radio._checked = false;
      }
    }
    this._checked = Boolean(value);
  }
  setAttribute(name, value) {
    const string = String(value);
    this.attributes.set(name, string);
    if (name === "class") this.className = string;
    else if (name.startsWith("data-")) this.dataset[dataName(name)] = string;
    else if (["hidden", "disabled", "open"].includes(name)) this[name] = true;
    else if (name === "checked") { this._checked = true; this.defaultChecked = true; }
    else if (name === "value") { this.value = string; this.defaultValue = string; }
    else if (["name", "type", "href"].includes(name)) this[name] = string;
  }
  getAttribute(name) {
    if (name === "class") return this.className || null;
    if (name.startsWith("data-")) return Object.hasOwn(this.dataset, dataName(name)) ? this.dataset[dataName(name)] : null;
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }
  removeAttribute(name) {
    this.attributes.delete(name);
    if (name.startsWith("data-")) delete this.dataset[dataName(name)];
    if (["hidden", "disabled", "open"].includes(name)) this[name] = false;
  }
  append(...nodes) {
    this._text = this._text || "";
    for (let node of nodes) {
      if (typeof node === "string") node = this.ownerDocument.createTextNode(node);
      node.remove();
      node.parentNode = this;
      this.children.push(node);
    }
  }
  replaceChildren(...nodes) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    this._text = "";
    if (this.tagName === "SELECT") { this._valueSet = false; this._value = ""; }
    this.append(...nodes);
  }
  remove() {
    if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }
  matches(selector) {
    const tag = selector.match(/^[a-zA-Z][\w-]*/)?.[0];
    if (tag && this.tagName !== tag.toUpperCase()) return false;
    for (const match of selector.matchAll(/\.([\w-]+)/g)) if (!this.classList.contains(match[1])) return false;
    for (const match of selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
      const value = this.getAttribute(match[1]);
      if (value === null || (match[2] !== undefined && value !== match[2])) return false;
    }
    if (selector.includes(":checked") && !this.checked) return false;
    return true;
  }
  querySelectorAll(selector) {
    const matches = [];
    for (const child of this.children) {
      if (child.matches(selector)) matches.push(child);
      matches.push(...child.querySelectorAll(selector));
    }
    return matches;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) {
    let node = this;
    while (node) { if (node.matches(selector)) return node; node = node.parentNode; }
    return null;
  }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  dispatchEvent(event) {
    if (!event.target) event.target = this;
    event.currentTarget = this;
    for (const listener of this.listeners.get(event.type) || []) listener(event);
    if (event.bubbles && !event.propagationStopped && this.parentNode) this.parentNode.dispatchEvent(event);
    return !event.defaultPrevented;
  }
  focus() { this.ownerDocument.activeElement = this; }
  click() {
    if (this.disabled) return;
    this.focus();
    const proceed = this.dispatchEvent(new FixtureEvent("click", { bubbles: true, cancelable: true }));
    if (this.tagName === "A" && this.download) this.ownerDocument.downloads.push({ href: this.href, filename: this.download });
    if (proceed && this.type === "reset") this.closest("form")?.reset();
  }
  reset() {
    if (!this.dispatchEvent(new FixtureEvent("reset", { bubbles: true, cancelable: true }))) return;
    for (const field of this.querySelectorAll("input")) { field.value = field.defaultValue; field.checked = field.defaultChecked; }
    for (const field of this.querySelectorAll("select")) { field._valueSet = false; field._value = ""; }
  }
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatchEvent(new FixtureEvent("close")); }
}

class FixtureDocument extends FixtureElement {
  constructor() { super("#document", null); this.ownerDocument = this; this.downloads = []; }
  createElement(tag) { return new FixtureElement(tag, this); }
  createElementNS(_namespace, tag) { return this.createElement(tag); }
  createTextNode(text) { const node = this.createElement("#text"); node._text = text; return node; }
  getElementById(id) { return this.querySelectorAll("*").find((node) => node.id === id) || null; }
}

function parseHtml(html) {
  const document = new FixtureDocument();
  const stack = [document];
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);
  for (const token of html.match(/<!--[^]*?-->|<![^>]*>|<[^>]+>|[^<]+/g) || []) {
    if (/^<!/.test(token)) continue;
    if (/^<\//.test(token)) {
      const tag = token.match(/^<\/([\w-]+)/)?.[1].toUpperCase();
      if (stack.at(-1).tagName !== tag) throw new Error("Malformed fixture HTML: " + token);
      if (stack.length > 1) stack.pop();
      continue;
    }
    if (token.startsWith("<")) {
      const tag = token.match(/^<([\w-]+)/)?.[1];
      if (!tag) continue;
      const node = document.createElement(tag);
      const attributes = token.slice(tag.length + 1).replace(/\/?\s*>$/, "");
      for (const match of attributes.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
        node.setAttribute(match[1], decode(match[2] ?? match[3] ?? match[4] ?? ""));
      }
      stack.at(-1).append(node);
      if (!voidTags.has(tag) && !/\/\s*>$/.test(token)) stack.push(node);
    } else stack.at(-1).append(document.createTextNode(decode(token)));
  }
  document.body = document.querySelector("body");
  document.activeElement = document.body;
  return document;
}

function createApp(options = {}) {
  const root = path.join(__dirname, "../..");
  const document = parseHtml(fs.readFileSync(path.join(root, "index.html"), "utf8"));
  const records = options.records || new Map();
  const faults = { read: false, write: false, access: false, ...options.faults };
  const writes = [];
  const timers = new Map();
  const windowEvents = document.createElement("window");
  const blobs = new Map();
  let timerId = 0;
  const localStorage = {
    getItem(key) { if (faults.read) throw new Error("SecurityError"); return records.has(key) ? records.get(key) : null; },
    setItem(key, value) { if (faults.write) throw new Error("QuotaExceededError"); records.set(key, value); writes.push(value); }
  };
  class FixedDate extends Date {
    constructor(...arguments_) { super(...(arguments_.length ? arguments_ : ["2026-11-26T12:00:00"])); }
    static now() { return new FixedDate().getTime(); }
  }
  const context = vm.createContext({
    document, Date: FixedDate, Intl, Blob, crypto: { randomUUID },
    get localStorage() { if (faults.access) throw new Error("SecurityError"); return localStorage; },
    location: { reload() {} },
    addEventListener: (...arguments_) => windowEvents.addEventListener(...arguments_),
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    URL: {
      createObjectURL(blob) { const url = "blob:fixture-" + blobs.size; blobs.set(url, blob); return url; },
      revokeObjectURL(url) { blobs.delete(url); }
    },
    Option: function (label, value) { const node = document.createElement("option"); node.textContent = label; node.value = value; return node; }
  });
  for (const filename of ["domain.js", "storage.js", "app.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, "js", filename), "utf8"), context, { filename });
  }
  return {
    document, context, records, writes, faults, blobs,
    $(id) { const node = document.getElementById(id); if (!node) throw new Error("Missing HTML element: " + id); return node; },
    event(node, type, extra = {}) { node.dispatchEvent(new FixtureEvent(type, { bubbles: true, cancelable: true, ...extra })); },
    storageEvent(key) { windowEvents.dispatchEvent(new FixtureEvent("storage", { key })); },
    flushTimers() {
      for (const [id, timer] of [...timers]) if (timer.delay === 0) { timers.delete(id); timer.callback(); }
    },
    saved() { const raw = records.get("expense-tracker:v1"); return raw ? JSON.parse(raw) : null; }
  };
}

module.exports = { createApp, FixtureEvent };
