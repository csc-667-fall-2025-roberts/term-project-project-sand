import { css, html, LitElement, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

export interface SelectOption {
  value: string;
  label: string;
}

@customElement("component-select")
export class SelectComponent extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    label {
      display: block;
      font-size: 0.875rem;
      line-height: 1.25rem;
      font-weight: 500;
      color: rgb(55 65 81);
    }

    .wrap {
      position: relative;
      display: block;
    }

    select {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      padding: 0.625rem 2.75rem 0.625rem 1rem;
      border: 1px solid rgb(209 213 219);
      border-radius: 0.5rem;
      background: rgb(255 255 255);
      color: rgb(17 24 39);
      font-size: 1rem;
      line-height: 1.5rem;
      transition:
        border-color 150ms ease,
        box-shadow 150ms ease;
      outline: none;
    }

    select::placeholder {
      color: rgb(156 163 175);
    }

    select:focus {
      border-color: transparent;
      box-shadow: 0 0 0 2px rgb(14 165 233);
    }

    select:focus-visible {
      border-color: transparent;
      box-shadow: 0 0 0 2px rgb(14 165 233);
    }

    select:disabled {
      background: rgb(243 244 246);
      cursor: not-allowed;
      opacity: 0.6;
    }

    .chevron {
      position: absolute;
      right: 0.875rem;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      width: 1.25rem;
      height: 1.25rem;
      color: rgb(107 114 128);
    }
  `;

  @property({ type: String }) label = "";
  @property({ type: String }) name = "";
  @property({ type: String }) value = "";
  @property({ type: String }) placeholder = "";
  @property({ type: Boolean, reflect: true }) required = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: Array }) options: SelectOption[] = [];

  private onChange(e: Event): void {
    const el = e.currentTarget;
    if (!(el instanceof HTMLSelectElement)) return;
    this.value = el.value;
    this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    this.dispatchEvent(
      new CustomEvent("value-changed", {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const showLabel = this.label.trim().length > 0;
    const showPlaceholder = this.placeholder.trim().length > 0;
    const value = this.value ?? "";

    return html`<div class="field" part="field">
      ${showLabel
        ? html`<label for=${this.name} part="label">${this.label}</label>`
        : nothing}
      <div class="wrap" part="wrap">
        <select
          id=${this.name}
          name=${this.name}
          .value=${value}
          ?required=${this.required}
          ?disabled=${this.disabled}
          @change=${this.onChange}
          part="select"
        >
          ${showPlaceholder
            ? html`<option value="" disabled ?selected=${!value}>
                ${this.placeholder}
              </option>`
            : nothing}
          ${this.options.map(
            (opt) => html`<option value=${opt.value}>${opt.label}</option>`,
          )}
        </select>
        <svg
          class="chevron"
          viewBox="0 0 20 20"
          aria-hidden="true"
          part="chevron"
        >
          <path
            fill="currentColor"
            fill-rule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z"
            clip-rule="evenodd"
          />
        </svg>
      </div>
    </div>`;
  }
}
