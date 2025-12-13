import { css, html, LitElement } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("component-card")
export class Card extends LitElement {
  static styles = css`
    section {
      background: white;
      padding: 1rem;
      border-radius: 0.5rem;
      box-shadow: 0 0 1rem 0 rgba(0, 0, 0, 0.1);
    }
  `;

  render() {
    return html`<section>
      <slot></slot>
    </section>`;
  }
}
