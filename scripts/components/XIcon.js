export class XIcon extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._state = 'default';
    this._size = 24;
    this._animated = false;
    this._tooltip = '';
    this._badge = '';
    this._disabled = false;
  }

  static get observedAttributes() {
    return ['state', 'size', 'animated', 'tooltip', 'badge', 'disabled'];
  }

  get state() {
    return this._state;
  }

  get disabled() {
    return this._disabled;
  }

  get tooltip() {
    return this._tooltip;
  }

  get badge() {
    return this._badge;
  }

  set state(value) {
    const validStates = ['default', 'active', 'disabled', 'loading', 'error', 'success'];
    if (validStates.includes(value)) {
      this._state = value;
      this.updateIcon();
    } else {
      console.warn(`Invalid state: ${value}. Using default state.`);
      this._state = 'default';
    }
  }

  set disabled(value) {
    this._disabled = value;
    this.updateIcon();
  }

  set tooltip(value) {
    this._tooltip = value;
    this.updateTooltip();
  }

  set badge(value) {
    this._badge = value;
    this.updateBadge();
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
    this.setupAccessibility();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    switch (name) {
      case 'state':
        this._state = newValue;
        break;
      case 'size':
        this._size = parseInt(newValue) || 24;
        break;
      case 'animated':
        this._animated = newValue !== null;
        break;
      case 'tooltip':
        this._tooltip = newValue;
        break;
      case 'badge':
        this._badge = newValue;
        break;
      case 'disabled':
        this._disabled = newValue !== null;
        break;
    }
    
    this.updateIcon();
  }

  setupAccessibility() {
    this.setAttribute('role', 'button');
    this.setAttribute('tabindex', this._disabled ? '-1' : '0');
    this.setAttribute('aria-disabled', String(this._disabled));
    if (this._tooltip) {
      this.setAttribute('aria-label', this._tooltip);
    }
  }

  setupEventListeners() {
    this.addEventListener('mouseenter', () => this.handleHover(true));
    this.addEventListener('mouseleave', () => this.handleHover(false));
    this.addEventListener('click', (e) => this.handleClick(e));
    
    this.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.handleClick(e);
      }
    });
  }

  handleHover(isHover) {
    if (this._disabled) return;
    
    const icon = this.shadowRoot.querySelector('.x-icon');
    icon.classList.toggle('x-icon--hover', isHover);
  }

  handleClick(event) {
    if (this._disabled) return;

    this.dispatchEvent(new CustomEvent('iconClick', {
      bubbles: true,
      composed: true,
      detail: {
        state: this._state,
        originalEvent: event
      }
    }));
  }

  updateIcon() {
    const icon = this.shadowRoot.querySelector('.x-icon');
    if (!icon) return;

    icon.className = 'x-icon';
    
    icon.classList.add(`x-icon--${this._state}`);
    
    if (this._animated) {
      if (this._state === 'loading') {
        icon.classList.add('x-icon--pulse');
      } else if (this._state === 'error') {
        icon.classList.add('x-icon--shake');
      } else if (this._state === 'success') {
        icon.classList.add('x-icon--bounce');
      }
    }

    this.setupAccessibility();
  }

  updateTooltip() {
    const tooltip = this.shadowRoot.querySelector('.x-icon-tooltip');
    if (tooltip) {
      tooltip.textContent = this._tooltip;
    }
  }

  updateBadge() {
    const badge = this.shadowRoot.querySelector('.x-icon-badge');
    if (badge) {
      badge.textContent = this._badge;
      badge.style.display = this._badge ? 'flex' : 'none';
    }
  }

  render() {
    const styles = document.createElement('style');
    styles.textContent = `
      @import '/styles/icon-styles.css';
      
      :host {
        display: inline-block;
        position: relative;
      }
      
      .x-icon {
        width: ${this._size}px;
        height: ${this._size}px;
        position: relative;
        cursor: ${this._disabled ? 'not-allowed' : 'pointer'};
      }

      .x-icon--default {
        color: #000000;
      }

      .x-icon--active {
        color: #1DA1F2;
      }

      .x-icon--disabled {
        color: #657786;
        opacity: 0.7;
      }
    `;

    const template = `
      <div class="x-icon x-icon--${this._state}"
           role="presentation">
        ${this.getIconSVG()}
        ${this._tooltip ? `
          <span class="x-icon-tooltip" role="tooltip">
            ${this.escapeHtml(this._tooltip)}
          </span>
        ` : ''}
        ${this._badge ? `
          <span class="x-icon-badge" aria-label="${this._badge} notifications">
            ${this.escapeHtml(this._badge)}
          </span>
        ` : ''}
      </div>
    `;

    this.shadowRoot.innerHTML = '';
    this.shadowRoot.appendChild(styles);
    this.shadowRoot.innerHTML += template;
  }

  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  getIconSVG() {
    return `
      <svg viewBox="0 0 24 24" 
           aria-hidden="true"
           width="${this._size}" 
           height="${this._size}"
           fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    `;
  }
}

customElements.define('x-icon', XIcon); 