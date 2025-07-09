// ==UserScript==
// @name         Pixiv - Make All Following Private
// @namespace    http://tampermonkey.net/
// @version      0.4
// @description  Adds a button to your Pixiv profile to set all your followed users to private in one click.
// @author       Me
// @match        https://www.pixiv.net/en/users/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=pixiv.net
// @connect      pixiv.net
// @grant        none
// @run-at       document-idle

// ==/UserScript==

(function () {
  "use strict";

  // --- 1. The Core Logic Function ---
  async function makeEverythingPrivate(button, statusEl) {
    const updateStatus = (message, isError = false) => {
      console.log(message);
      statusEl.textContent = message;
      // Use inline style for dynamic color feedback
      statusEl.style.color = isError ? "#ff4d4d" : "inherit";
    };

    try {
      button.disabled = true;
      button.style.cursor = "not-allowed";
      button.style.opacity = "0.6";

      // --- Get user metadata from the page ---
      updateStatus("Initializing: Getting user ID and CSRF token...");
      const nextDataElement = document.querySelector("#__NEXT_DATA__");
      if (!nextDataElement) {
        throw new Error(
          "Could not find Pixiv's data element (#__NEXT_DATA__). Is the page fully loaded?"
        );
      }

      const props = JSON.parse(nextDataElement.innerHTML).props.pageProps;
      const metadata = JSON.parse(props.serverSerializedPreloadedState);
      const token = metadata.api.token;
      const userId = metadata.userData.self.id;

      if (!token || !userId) {
        throw new Error(
          "Could not extract token or user ID. Pixiv may have changed its page structure."
        );
      }
      updateStatus(
        `User ID: ${userId}, Token found. Fetching followed users...`
      );

      // --- Get the complete list of users you are following (with pagination) ---
      // A small delay function to avoid rate limits.
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      let allFollowingUsers = [];
      let offset = 0;
      const limit = 100; // The API fetches users in chunks of up to 100
      let totalFollowing;

      do {
        const apiUrl = `https://www.pixiv.net/ajax/user/${userId}/following?offset=${offset}&limit=${limit}&rest=show&lang=en`; // rest=show for public, hide for private.
        const res = await fetch(apiUrl, { headers: { "x-user-id": userId } });
        if (!res.ok)
          throw new Error(
            `Failed to fetch following list. Status: ${res.status}`
          );

        const data = await res.json();
        if (data.error)
          throw new Error(
            `API error while fetching following list: ${data.message}`
          );

        const users = data.body.users;
        allFollowingUsers.push(...users);

        // On the first fetch, get the total count.
        if (totalFollowing === undefined) {
          totalFollowing = data.body.total;
          if (totalFollowing === 0) {
            updateStatus("You are not following anyone. Script finished.");
            button.disabled = false;
            button.style.cursor = "pointer";
            button.style.opacity = "1";
            return;
          }
        }

        updateStatus(
          `Fetched ${allFollowingUsers.length} / ${totalFollowing} users...`
        );
        offset += users.length === 0 ? totalFollowing : users.length; // For some reason Pixiv returns the wrong number for some users
        await wait(300); // Wait 300ms between fetching pages, this is a guess.
      } while (offset < totalFollowing);

      updateStatus(
        `Successfully fetched all ${allFollowingUsers.length} followed users. Now making them private...`
      );

      // --- Iterate and change the privacy setting for each user ---
      let successCount = 0;
      // Use a for...of loop, which works correctly with await.
      for (const [index, user] of allFollowingUsers.entries()) {
        updateStatus(
          `[${index + 1}/${totalFollowing}] Processing user: ${user.userName}`
        );
        try {
          const changeRes = await fetch(
            "https://www.pixiv.net/ajax/following/user/restrict_change",
            {
              method: "POST",
              headers: {
                "content-type":
                  "application/x-www-form-urlencoded; charset=utf-8",
                "x-csrf-token": token,
              },
              body: `user_id=${user.userId}&restrict=1`, // restrict=1 for private 0 for public
            }
          );

          const changeData = await changeRes.json();
          if (!changeRes.ok || changeData.error) {
            console.error(
              `Failed to update ${user.userName}. API response: ${
                changeData.message || "Unknown error"
              }`
            );
          } else {
            successCount++;
          }
          await wait(250); // Wait 250ms between each update request, this is a guess.
        } catch (userError) {
          console.error(
            `An error occurred while processing user ${user.userName}:`,
            userError.message
          );
        }
      }

      updateStatus(
        `Finished! Successfully updated ${successCount} out of ${totalFollowing} users. Reloading page to see changes...`,
        false
      );
      setTimeout(() => window.location.reload(), 5000);
    } catch (error) {
      updateStatus(`An error occurred: ${error.message}`, true);
      console.error("Script stopped due to an error:", error);
      button.disabled = false; // Re-enable the button on failure
      button.style.cursor = "pointer";
      button.style.opacity = "1";
    }
  }

  // --- 2. Function to Add the Button to the DOM ---
  function addTheButton() {
    const targetParent = document.querySelector(
      'h2[font-size="20"][color="text2"]'
    );
    if (targetParent && !document.getElementById("make-private-btn")) {
      const parentContainer =
        targetParent.parentElement.parentElement.parentElement;

      // Create a wrapper for better layout without CSS
      const wrapper = document.createElement("div");
      wrapper.style.display = "flex";
      wrapper.style.flexDirection = "column";
      wrapper.style.marginRight = "5px";
      wrapper.style.alignItems = "flex-start";

      const button = document.createElement("button");
      button.textContent = "Make everything private";
      button.id = "make-private-btn";
      button.className = "charcoal-button"; // Set class for Pixiv's styling

      const statusEl = document.createElement("div");
      statusEl.id = "make-private-status";
      button.addEventListener("click", () => {
        if (
          confirm(
            "Are you sure you want to make ALL your followed users private? This will send many requests to Pixiv and may take a while."
          )
        ) {
          makeEverythingPrivate(button, statusEl);
        }
      });

      wrapper.appendChild(button);
      wrapper.appendChild(statusEl);
      parentContainer.prepend(wrapper);
    }
  }

  // --- 3. Use a MutationObserver to handle Pixiv's Single-Page-App navigation ---
  const observer = new MutationObserver((mutations) => {
    // Use requestAnimationFrame to avoid re-triggering the observer unnecessarily
    window.requestAnimationFrame(addTheButton);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Also run it once on script load
  addTheButton();
})();
