class AuthShell extends HTMLElement {
  connectedCallback(): void {
    this.render();
  }

  private render(): void {
    const header = this.querySelector('[slot="header"]');
    const body = this.querySelector('[slot="body"]');
    const footer = this.querySelector('[slot="footer"]');

    this.className =
      "min-h-screen flex items-center justify-center bg-linear-to-br from-amber-50 via-orange-50 to-pink-50";

    this.innerHTML = `
      <section class="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl border-2 border-amber-200 flex flex-col gap-4">
        <slot name="header"></slot>
        <slot name="body"></slot>
        <slot name="footer"></slot>
      </section>
    `;

    const headerTarget = this.querySelector('slot[name="header"]');
    const bodyTarget = this.querySelector('slot[name="body"]');
    const footerTarget = this.querySelector('slot[name="footer"]');

    if (header && headerTarget) {
      header.removeAttribute("slot");
      headerTarget.replaceWith(header);
    }

    if (body && bodyTarget) {
      body.removeAttribute("slot");
      bodyTarget.replaceWith(body);
    }

    if (footer && footerTarget) {
      footer.removeAttribute("slot");
      footerTarget.replaceWith(footer);
    }
  }
}

customElements.define("auth-shell", AuthShell);
