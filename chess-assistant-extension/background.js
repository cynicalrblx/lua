const runtime = typeof browser !== "undefined" ? browser : chrome;

runtime.commands.onCommand.addListener(async (command) => {
  const [tab] = await runtime.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return;
  }

  const rankByCommand = {
    "show-best-move": 1,
    "show-second-move": 2,
    "show-third-move": 3
  };

  const rank = rankByCommand[command];
  if (!rank) {
    return;
  }

  runtime.tabs.sendMessage(tab.id, { type: "analyze", rank });
});
