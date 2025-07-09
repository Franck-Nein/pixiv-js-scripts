/**
 * How to use:
 * 1. Go to your "Following" page on Pixiv.
 * 2. Open the browser's Developer Tools.
 * 3. Paste this script into the Console and press Enter.
 */
(async function () {
  console.log("Starting the Pixiv follow privacy script...");

  // A small delay function to avoid rate limits.
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    // --- 1. Get user metadata from the page ---
    console.log("Attempting to get your User ID and CSRF token...");
    const nextDataElement = document.querySelector("#__NEXT_DATA__");
    if (!nextDataElement) {
      throw new Error("Could not find Pixiv's data element (#__NEXT_DATA__).");
    }

    const props = JSON.parse(nextDataElement.innerHTML).props.pageProps;
    const metadata = JSON.parse(props.serverSerializedPreloadedState);

    const token = metadata.api.token;
    const userId = metadata.userData.self.id;

    if (!token || !userId) {
      throw new Error(
        "Could not extract token or user ID. Pixiv might have changed its page structure."
      );
    }
    console.log(`User ID: ${userId}, Token found.`);

    // --- 2. Get the complete list of users you are following (with pagination) ---
    let allFollowingUsers = [];
    let offset = 0;
    const limit = 100; // The API fetches users in chunks of up to 100
    let totalFollowing;

    console.log("Fetching the list of all users you follow...");

    do {
      console.log(`Fetching users from offset ${offset}...`);
      const apiUrl = `https://www.pixiv.net/ajax/user/${userId}/following?offset=${offset}&limit=${limit}&rest=show&lang=en`; // rest=show for public, hide for private.
      const res = await fetch(apiUrl, {
        headers: { "x-user-id": userId },
      });

      if (!res.ok) {
        throw new Error(
          `Failed to fetch following list. Status: ${res.status}`
        );
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(
          `API error while fetching following list: ${data.message}`
        );
      }

      const users = data.body.users;
      allFollowingUsers.push(...users);

      // On the first fetch, get the total count.
      if (totalFollowing === undefined) {
        totalFollowing = data.body.total;
        console.log(`Found a total of ${totalFollowing} users to process.`);
        if (totalFollowing === 0) {
          console.log("You are not following anyone. Script finished.");
          return;
        }
      }

      offset += users.length === 0 ? totalFollowing : users.length; // For some reason Pixiv returns the wrong number for some users
      await wait(300); // Wait 300ms between fetching pages, this is a guess.
    } while (offset < totalFollowing);

    console.log(
      `Successfully fetched all ${allFollowingUsers.length} followed users.`
    );

    // --- 3. Iterate and change the privacy setting for each user ---
    console.log("Starting to set each followed user to 'Private'...");
    let successCount = 0;

    // Use a for...of loop, which works correctly with await.
    for (const user of allFollowingUsers) {
      console.log(`Processing user: ${user.userName} (ID: ${user.userId})`);

      try {
        const changeRes = await fetch(
          "https://www.pixiv.net/ajax/following/user/restrict_change",
          {
            credentials: "include",
            headers: {
              "content-type":
                "application/x-www-form-urlencoded; charset=utf-8",
              "x-csrf-token": token,
            },
            referrer: `https://www.pixiv.net/en/users/${userId}/following`,
            body: `user_id=${user.userId}&restrict=1`, // restrict=1 for private 0 for public
            method: "POST",
            mode: "cors",
          }
        );

        const changeData = await changeRes.json();

        if (!changeRes.ok || changeData.error) {
          console.log(
            `Failed to update user ${user.userName}. API response: ${
              changeData.message || "Unknown error"
            }`
            // throw new Error(
            //   `Failed to update user ${user.userName}. API response: ${
            //     changeData.message || "Unknown error"
            //   }`
            // );
          );
        }

        console.log(`Successfully set ${user.userName} to private.`);
        successCount++;
        await wait(250); // Wait 250ms between each update request, this is a guess.
      } catch (error) {
        console.error(
          `An error occurred while processing user ${user.userName}.`
        );
        console.error("Error details:", error.message);
        //return; // Stop execution
      }
    }

    console.log(
      `Successfully updated ${successCount} out of ${totalFollowing} users.`
    );
    document.location = document.location;
  } catch (error) {
    console.error("An error occurred and the script had to stop.");
    console.error("Error details:", error.message);
  }
})();
