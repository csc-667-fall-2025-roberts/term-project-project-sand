import { client, type User } from "./api";
import Observable from "./observable";

const user = new Observable<User | null>(null);

document.addEventListener("DOMContentLoaded", async () => {
  user.subscribe((newValue) => {
    alert(JSON.stringify(newValue));
  });

  const data = await client.whoAmI();
  if (!data) return;

  user.set(data);
});
