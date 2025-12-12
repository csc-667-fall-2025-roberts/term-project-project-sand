import { client } from "../api";
import UserStorage from "../storage/user";
import "./button";

class LayoutHeader extends HTMLElement {
  private user: UserStorage = new UserStorage(null, [
    (user) => this.renderWelcomeElement(user?.displayName),
  ]);
  private welcomeElement: HTMLElement | null = null;
  private nameElement: HTMLElement | null = null;
  private logoutButton: HTMLButtonElement | null = null;

  connectedCallback(): void {
    this.render();

    this.welcomeElement = this.querySelector<HTMLElement>("#user-welcome");
    this.nameElement = this.querySelector<HTMLElement>("#user-name");
    this.logoutButton = this.querySelector<HTMLButtonElement>("#logout");

    if (this.logoutButton) {
      this.logoutButton.addEventListener(
        "click",
        this.handleLogoutButtonClick.bind(this),
      );
    }

    this.loadUser();
  }

  private render(): void {
    const userWelcomeClasses = ["font-semibold", "hidden"];

    const user = this.user.get();
    const userName = user?.displayName ?? "";

    if (user) {
      userWelcomeClasses.splice(userWelcomeClasses.indexOf("hidden"), 1);
    }
    this.innerHTML = `
        <header class="bg-linear-to-r from-amber-500 via-orange-500 to-pink-500 shadow-xl text-white">
          <div
            class="flex justify-between items-center container p-2 py-4 sm:p-4 mx-auto"
          >
            <h1 class="text-3xl font-black text-white drop-shadow-lg">
              WEBOPOLY
            </h1>
            <di class="flex items-center gap-4">
              <span id="user-welcome" class="${userWelcomeClasses.join(" ")}">Welcome, <span id="user-name" class="font-bold">${userName}</span></span>
              <component-button id="logout" label="Logout" size="sm" variant="secondary"></component-button>
            </div>
          </div>
        </header>
      `;
  }

  private async handleLogoutButtonClick(): Promise<void> {
    this.user.clear();
    await client.logout(true);
  }

  private async loadUser(): Promise<void> {
    const data = await client.whoAmI();
    this.user.set(data);
  }

  private async renderWelcomeElement(name: string | undefined): Promise<void> {
    if (name && this.welcomeElement && this.nameElement) {
      this.nameElement.textContent = name;
      this.welcomeElement.classList.remove("hidden");
    }
  }
}

customElements.define("layout-header", LayoutHeader);
