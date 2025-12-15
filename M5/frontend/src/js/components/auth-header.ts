class AuthHeader extends HTMLElement {
  static observedAttributes = ["subtitle"];

  connectedCallback(): void {
    this.render();
  }

  attributeChangedCallback(): void {
    this.render();
  }

  private render(): void {
    const subtitle = this.getAttribute("subtitle") ?? "";
    this.innerHTML = `
    <div class="text-center flex flex-col gap-2">
      <h1 class="text-5xl font-black bg-linear-to-r from-amber-600 via-orange-600 to-pink-600 bg-clip-text text-transparent drop-shadow-lg">
        WEBOPOLY
      </h1>
      <div class="text-gray-700 font-semibold">${subtitle}</div>
    </div>
    `;
  }
}

customElements.define("auth-header", AuthHeader);
