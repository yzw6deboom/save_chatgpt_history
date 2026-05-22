import { defineBackground } from "wxt/utils/define-background";

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(() => {
    // Framework scaffold only. Business logic will be added in later milestones.
  });
});
