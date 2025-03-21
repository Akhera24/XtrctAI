// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getProfileData') {
        const data = extractProfileData();
        sendResponse({ success: true, data });
    }
    return true;
});

function extractProfileData() {
    // These selectors might need to be updated based on X's current DOM structure
    const username = document.querySelector('div[data-testid="UserName"]')?.textContent || '';
    const bio = document.querySelector('div[data-testid="UserDescription"]')?.textContent || '';
    const followers = document.querySelector('a[href$="/followers"] span')?.textContent || '0';
    const following = document.querySelector('a[href$="/following"] span')?.textContent || '0';

    // Get recent posts
    const posts = Array.from(document.querySelectorAll('article[data-testid="tweet"]')).map(post => ({
        text: post.querySelector('div[data-testid="tweetText"]')?.textContent || '',
        likes: post.querySelector('div[data-testid="like"]')?.textContent || '0',
        retweets: post.querySelector('div[data-testid="retweet"]')?.textContent || '0'
    }));

    return {
        username,
        bio,
        followers,
        following,
        recentPosts: posts.slice(0, 5) // Get only the 5 most recent posts
    };
}