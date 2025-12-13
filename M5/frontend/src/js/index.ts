import type { SelectComponent } from "./components/select";

function wireMaxPlayersSelect(): void {
  const select = document.getElementById("maxPlayersSelect") as SelectComponent;
  if (!select) return;

  select.options = [
    { value: "2", label: "2 Players" },
    { value: "3", label: "3 Players" },
    { value: "4", label: "4 Players" },
    { value: "5", label: "5 Players" },
    { value: "6", label: "6 Players" },
  ];
  select.addEventListener("change", (_event) => {
    // console.log(_event.target?.value);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  wireMaxPlayersSelect();
});
