import { client, type User } from "./api";
import Observable from "./observable";

const user = new Observable<User | null>(null);

const statusEl = document.querySelector<HTMLElement>("#auth-status");
const nameEl = document.querySelector<HTMLElement>("#user-name");
const emailEl = document.querySelector<HTMLElement>("#user-email");
const refetchButton = document.querySelector<HTMLButtonElement>("#refetch");
const logoutButton = document.querySelector<HTMLButtonElement>("#logout");

function setStatus(message: string): void {
  if (statusEl) {
    statusEl.textContent = message;
  }
}

function renderUser(value: User | null): void {
  if (nameEl) {
    nameEl.textContent = value?.displayName ?? "-";
  }
  if (emailEl) {
    emailEl.textContent = value?.email ?? "-";
  }

  if (!value) {
    setStatus("Not authenticated. Redirecting to login...");
    void client.logout(true);
  } else {
    setStatus("Signed in");
  }
}

async function loadProfile(): Promise<void> {
  setStatus("Loading profile...");
  const data = await client.whoAmI();
  user.set(data);
}

user.subscribe(renderUser);

document.addEventListener("DOMContentLoaded", () => {
  void loadProfile();

  if (refetchButton) {
    refetchButton.addEventListener("click", () => {
      void loadProfile();
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      setStatus("Logging out...");
      await client.logout(true);
    });
  }
});
