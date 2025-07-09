/**
* Pixiv bulk private/public follows
* 
* Sets all your follows from public to private or vice-versa based on the type viewed.
* To be used from your "Following" page.
*
* Wrapped in an IIFE for browser compatibility.
*/

(async function iife() {

function getSafe(fn, defaultVal) {
	try {
	  return fn();
	} catch (e) {
	  return defaultVal;
	}
}

const sleep = ms => new Promise(res => setTimeout(res, ms));

var FollowCount = 0
var FollowsEdited = 0

// Get the follow count
var FollowCount = getSafe(() => parseInt(document.querySelector('h2[font-size="20"][color="text2"]').parentElement.lastChild.firstChild.textContent))

// error checking for follow count
if (FollowCount == 'not-found') {
	console.warn('Could not find follow count.')
} else {
	console.log(`Found ${FollowCount} follows.`)
}

var OldArtistName = ""

while ((FollowsEdited < FollowCount) || (FollowCount == 'not-found')) {
	
	// --------------------- Wait for follow list to refresh ---------------------
	var DurationCounter = 0
	while (true) {

		// Get the first name in the list
		var ArtistName = getSafe(() => document.querySelector('section a[data-gtm-value]:only-child').textContent)

		// Check if the name is new
		if ((ArtistName != OldArtistName) && (typeof ArtistName != 'undefined')) {
			break
		}
		
		DurationCounter++

		// Stop the script after 10 seconds of no progress
		if (DurationCounter > 100) {
			if (FollowsEdited >= 1) {
				throw new Error('No new follows found, script stopped.');
			}else {
				throw new Error('Could not find the artist name, check the guide for help with updating the class name.');
			}	
		}

		await sleep(100)
	}
	OldArtistName = ArtistName

	
	// --------------------- Click the buttons ---------------------
	var DurationCounter = 0
	while (true) {

		var Button = document.querySelector('div.gtm-profile-user-menu-restrict-changing[role=button]')
		var ButtonAriaDisabled = getSafe(() => Button.getAttribute('aria-disabled'))
		
		// Click private/public button when it exists & isn't disabled
		if (ButtonAriaDisabled == 'false')
		{
			Button.click()
			break
		}

		// Click the follow dropdown menu button if the private/public button is not visible
		if (ButtonAriaDisabled != 'true') {
			getSafe(() => document.querySelector('button[data-click-label="follow"]').nextElementSibling.firstChild.click())
		}

		DurationCounter++

		// Stop the script after 10 seconds of no progress
		if (DurationCounter > 100) {
			if (!document.querySelector('button[data-click-label="follow"]').nextElementSibling.firstChild)
			{
				throw new Error('Could not find the dropdown menu button, check the guide for help with updating the class name.');
			} else {
				throw new Error('Could not find the "Set as private/public" button, check the guide for help with updating the class name.');
			}
		}

		await sleep(100)
	}
	
	FollowsEdited++
	// error checking for follow count
	if (FollowCount != 'not-found') {
		console.log(`Changed ${FollowsEdited}/${FollowCount} follows, ${FollowCount - FollowsEdited} remaining.`)
	} else {
		console.log(`Changed ${FollowsEdited} follows.`)
	}
	
}

console.log('Script finished.')

})()
