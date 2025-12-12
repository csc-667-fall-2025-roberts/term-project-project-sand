class Button extends HTMLElement {
  connectedCallback(): void {
    this.render();
  }

  private render(): void {
    const label =
      this.textContent?.trim() || this.getAttribute("label") || "Submit";
    const disabled = this.hasAttribute("disabled") ? "disabled" : "";

    this.innerHTML = `
      <button
        type="submit"
        ${disabled}
        class="not-disabled:cursor-pointer bg-linear-to-r from-amber-500 via-orange-500 to-pink-500 hover:from-amber-600 hover:via-orange-600 hover:to-pink-600 active:from-amber-700 active:via-orange-700 active:to-pink-700 text-white font-bold py-2.5 px-6 rounded-lg transition duration-200 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 shadow-md hover:shadow-lg w-full"
      >
        ${label}
      </button>
    `;
  }
}

customElements.define("component-button", Button);
