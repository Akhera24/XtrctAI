// Post Controller - Connects the UI to the PostGenerator component
import { postGenerator } from './components/PostGenerator.js';

export class PostController {
  constructor() {
    this.initializeEventListeners();
    this.currentPost = null;
    this.savedPosts = this.loadSavedPosts();
  }
  
  initializeEventListeners() {
    // Optimization option cards
    document.querySelectorAll('.option-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // Remove selected class from all cards
        document.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
        // Add selected class to clicked card
        e.currentTarget.classList.add('selected');
      });
    });
    
    // Generate post button
    const generateButton = document.getElementById('generatePostButton');
    if (generateButton) {
      generateButton.addEventListener('click', () => this.generatePost());
    }
    
    // Reset button
    const resetButton = document.getElementById('resetPostOptions');
    if (resetButton) {
      resetButton.addEventListener('click', () => this.resetPostOptions());
    }
    
    // Copy post button
    const copyButton = document.getElementById('copyPostButton');
    if (copyButton) {
      copyButton.addEventListener('click', () => this.copyPostToClipboard());
    }
    
    // Regenerate post button
    const regenerateButton = document.getElementById('regeneratePostButton');
    if (regenerateButton) {
      regenerateButton.addEventListener('click', () => this.generatePost());
    }
    
    // Save post button
    const saveButton = document.getElementById('savePostButton');
    if (saveButton) {
      saveButton.addEventListener('click', () => this.savePost());
    }
  }
  
  // Generate a post based on the selected options
  async generatePost() {
    try {
      // Get the selected options
      const options = this.getPostOptions();
      
      // Validate that a topic was entered
      if (!options.topic || options.topic.trim() === '') {
        this.showError('Please enter a topic for your post');
        return;
      }
      
      // Show loading state
      this.showLoading(true);
      
      // Call the post generator
      const post = await postGenerator.generatePost(options);
      
      // Save the current post
      this.currentPost = post;
      
      // Update the UI with the generated post
      this.updatePostResults(post);
      
      // Hide loading state
      this.showLoading(false);
      
      // Show results section
      document.getElementById('postResults').classList.remove('hidden');
    } catch (error) {
      console.error('Error generating post:', error);
      this.showError('Failed to generate post: ' + error.message);
      this.showLoading(false);
    }
  }
  
  // Get the selected post options from the UI
  getPostOptions() {
    const selectedGoalCard = document.querySelector('.option-card.selected');
    const goal = selectedGoalCard ? selectedGoalCard.dataset.goal : 'engagement';
    
    return {
      topic: document.getElementById('postTopic').value,
      tone: document.getElementById('postTone').value,
      goal: goal,
      length: document.getElementById('postLength').value,
      include_hashtags: document.getElementById('includeHashtags').value === 'true',
      targeting: document.getElementById('targetAudience').value
    };
  }
  
  // Reset post options to defaults
  resetPostOptions() {
    // Reset topic input
    document.getElementById('postTopic').value = '';
    
    // Reset selects to first option
    document.getElementById('postTone').selectedIndex = 0;
    document.getElementById('postLength').selectedIndex = 1; // Medium is default
    document.getElementById('includeHashtags').selectedIndex = 0; // Yes is default
    document.getElementById('targetAudience').selectedIndex = 0; // General is default
    
    // Reset goal to Engagement
    document.querySelectorAll('.option-card').forEach(card => {
      card.classList.remove('selected');
      if (card.dataset.goal === 'engagement') {
        card.classList.add('selected');
      }
    });
    
    // Hide results section
    document.getElementById('postResults').classList.add('hidden');
  }
  
  // Update the UI with the generated post
  updatePostResults(post) {
    // Update the post content
    const contentTextarea = document.getElementById('generatedPostContent');
    if (contentTextarea) {
      contentTextarea.value = post.content;
    }
    
    // Update metrics
    this.updateMetrics(post.metrics);
    
    // Update variations
    this.updateVariations(post.variations);
  }
  
  // Update metrics display
  updateMetrics(metrics) {
    // Engagement metrics
    const engagementMetric = document.getElementById('engagementMetric');
    if (engagementMetric && metrics.estimatedEngagement) {
      const engagement = metrics.estimatedEngagement;
      engagementMetric.textContent = `${engagement.likes} ❤️ | ${engagement.retweets} 🔁`;
    }
    
    // Optimal posting time
    const optimalTimeMetric = document.getElementById('optimalTimeMetric');
    if (optimalTimeMetric && metrics.optimalPostingTime) {
      const time = metrics.optimalPostingTime;
      optimalTimeMetric.textContent = `${time.day}, ${time.time}`;
    }
    
    // Audience match
    const audienceMatchMetric = document.getElementById('audienceMatchMetric');
    if (audienceMatchMetric && metrics.audienceMatch) {
      audienceMatchMetric.textContent = `${metrics.audienceMatch}%`;
    }
    
    // Hashtags
    const hashtagsMetric = document.getElementById('hashtagsMetric');
    if (hashtagsMetric && metrics.recommendedHashtags) {
      hashtagsMetric.textContent = metrics.recommendedHashtags.slice(0, 3).join(' ');
    }
  }
  
  // Update post variations
  updateVariations(variations) {
    const variationsContainer = document.getElementById('postVariations');
    if (!variationsContainer) return;
    
    // Clear previous variations
    variationsContainer.innerHTML = '';
    
    // Add each variation
    variations.forEach((variation, index) => {
      const variationElement = document.createElement('div');
      variationElement.className = 'post-variation';
      variationElement.innerHTML = `
        <div class="variation-type">${variation.type}</div>
        <div class="variation-content">${variation.content.replace(/\n/g, '<br>')}</div>
        <button class="use-variation-button" data-index="${index}">Use This Version</button>
      `;
      
      variationsContainer.appendChild(variationElement);
      
      // Add event listener for the Use This Version button
      const useButton = variationElement.querySelector('.use-variation-button');
      useButton.addEventListener('click', () => {
        document.getElementById('generatedPostContent').value = variation.content;
        
        // Update the current post with this variation
        if (this.currentPost) {
          this.currentPost.content = variation.content;
        }
      });
    });
  }
  
  // Copy post to clipboard
  copyPostToClipboard() {
    const contentTextarea = document.getElementById('generatedPostContent');
    if (contentTextarea) {
      contentTextarea.select();
      document.execCommand('copy');
      
      // Show success message
      this.showSuccess('Post copied to clipboard!');
    }
  }
  
  // Save post to local storage
  savePost() {
    if (!this.currentPost) {
      this.showError('No post to save');
      return;
    }
    
    try {
      // Create a new saved post object
      const newSavedPost = {
        id: Date.now(),
        content: this.currentPost.content,
        metrics: this.currentPost.metrics,
        timestamp: new Date().toISOString(),
        options: this.getPostOptions()
      };
      
      // Add to saved posts array
      this.savedPosts.push(newSavedPost);
      
      // Save to local storage
      this.saveSavedPosts();
      
      // Update the saved posts list
      this.updateSavedPostsList();
      
      // Show success message
      this.showSuccess('Post saved successfully!');
    } catch (error) {
      console.error('Error saving post:', error);
      this.showError('Failed to save post: ' + error.message);
    }
  }
  
  // Load saved posts from local storage
  loadSavedPosts() {
    try {
      const savedPostsJson = localStorage.getItem('savedPosts');
      return savedPostsJson ? JSON.parse(savedPostsJson) : [];
    } catch (error) {
      console.error('Error loading saved posts:', error);
      return [];
    }
  }
  
  // Save posts to local storage
  saveSavedPosts() {
    try {
      localStorage.setItem('savedPosts', JSON.stringify(this.savedPosts));
    } catch (error) {
      console.error('Error saving posts to local storage:', error);
    }
  }
  
  // Update the saved posts list in the UI
  updateSavedPostsList() {
    const postList = document.getElementById('postList');
    if (!postList) return;
    
    // Clear the current list
    postList.innerHTML = '';
    
    // If no saved posts, show message
    if (this.savedPosts.length === 0) {
      postList.innerHTML = '<div class="empty-state"><p>No saved posts yet</p></div>';
      return;
    }
    
    // Add each saved post
    this.savedPosts.forEach(post => {
      const postElement = document.createElement('div');
      postElement.className = 'saved-post';
      
      // Format the date
      const date = new Date(post.timestamp);
      const formattedDate = `${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
      
      // Format hashtags
      const hashtags = post.metrics?.recommendedHashtags?.join(' ') || '';
      
      postElement.innerHTML = `
        <div class="saved-post-header">
          <div class="saved-post-date">${formattedDate}</div>
          <div class="saved-post-metrics">
            ${post.metrics?.estimatedEngagement?.likes || 0} ❤️ | 
            ${post.metrics?.estimatedEngagement?.retweets || 0} 🔁
          </div>
        </div>
        <div class="saved-post-content">${post.content.replace(/\n/g, '<br>')}</div>
        <div class="saved-post-hashtags">${hashtags}</div>
        <div class="saved-post-actions">
          <button class="delete-post-button" data-id="${post.id}" title="Delete post">
            <span class="icon">🗑️</span>
          </button>
          <button class="edit-post-button" data-id="${post.id}" title="Edit post">
            <span class="icon">✏️</span>
          </button>
          <button class="use-post-button" data-id="${post.id}" title="Use post">
            <span class="icon">📋</span>
          </button>
        </div>
      `;
      
      postList.appendChild(postElement);
      
      // Add event listeners for action buttons
      const deleteButton = postElement.querySelector('.delete-post-button');
      deleteButton.addEventListener('click', () => this.deletePost(post.id));
      
      const editButton = postElement.querySelector('.edit-post-button');
      editButton.addEventListener('click', () => this.editPost(post.id));
      
      const useButton = postElement.querySelector('.use-post-button');
      useButton.addEventListener('click', () => this.usePost(post.id));
    });
  }
  
  // Delete a saved post
  deletePost(id) {
    // Find the post index
    const postIndex = this.savedPosts.findIndex(post => post.id === id);
    if (postIndex === -1) return;
    
    // Remove the post
    this.savedPosts.splice(postIndex, 1);
    
    // Save to local storage
    this.saveSavedPosts();
    
    // Update the UI
    this.updateSavedPostsList();
    
    // Show success message
    this.showSuccess('Post deleted');
  }
  
  // Edit a saved post
  editPost(id) {
    // Find the post
    const post = this.savedPosts.find(post => post.id === id);
    if (!post) return;
    
    // Load the post into the editor
    document.getElementById('postTopic').value = post.options.topic || '';
    document.getElementById('postTone').value = post.options.tone || 'professional';
    document.getElementById('postLength').value = post.options.length || 'medium';
    document.getElementById('includeHashtags').value = post.options.include_hashtags ? 'true' : 'false';
    document.getElementById('targetAudience').value = post.options.targeting || 'general';
    
    // Set the goal
    document.querySelectorAll('.option-card').forEach(card => {
      card.classList.remove('selected');
      if (card.dataset.goal === post.options.goal) {
        card.classList.add('selected');
      }
    });
    
    // Switch to the Posts tab
    document.querySelector('.tab-button[data-tab="posts"]').click();
    
    // Set the current post
    this.currentPost = {
      content: post.content,
      metrics: post.metrics,
      variations: [] // No variations when editing
    };
    
    // Update the UI
    this.updatePostResults(this.currentPost);
    
    // Show the results section
    document.getElementById('postResults').classList.remove('hidden');
  }
  
  // Use a saved post (copy to clipboard)
  usePost(id) {
    // Find the post
    const post = this.savedPosts.find(post => post.id === id);
    if (!post) return;
    
    // Copy to clipboard
    const textarea = document.createElement('textarea');
    textarea.value = post.content;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    
    // Show success message
    this.showSuccess('Post copied to clipboard!');
  }
  
  // Show loading state
  showLoading(isLoading) {
    const generateButton = document.getElementById('generatePostButton');
    
    if (isLoading) {
      if (generateButton) {
        generateButton.disabled = true;
        generateButton.innerHTML = '<span class="loading-spinner-small"></span> Generating...';
      }
    } else {
      if (generateButton) {
        generateButton.disabled = false;
        generateButton.innerHTML = '<span class="button-icon">✨</span> Generate Post';
      }
    }
  }
  
  // Show error message
  showError(message) {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = 'toast toast-error';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Show the toast
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Hide after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
  }
  
  // Show success message
  showSuccess(message) {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = 'toast toast-success';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Show the toast
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Hide after 3 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
  }
}

// Initialize the post controller when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  window.postController = new PostController();
}); 