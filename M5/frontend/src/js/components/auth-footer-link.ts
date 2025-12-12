class AuthFooterLink extends HTMLElement {
  static observedAttributes = ["prompt", "href", "text"];

  connectedCallback(): void {
    this.render();
  }

  attributeChangedCallback(): void {
    this.render();
  }

  private render(): void {
    const prompt = this.getAttribute("prompt") ?? "";
    const href = this.getAttribute("href") ?? "#";
    const text = this.getAttribute("text") ?? "";

    this.innerHTML = `
      <p class="text-center text-sm text-gray-600">
        ${prompt}
        <a href="${href}" class="text-sky-600 hover:text-sky-700 font-semibold">
          ${text}
        </a>
      </p>
    `;
  }
}

customElements.define("auth-footer-link", AuthFooterLink);
