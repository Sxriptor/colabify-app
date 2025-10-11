// Simple test script to verify Git monitoring integration
// Run this in the Electron console to test the integration

console.log('🧪 Testing Git Monitoring Integration...');

// Test 1: Check if electronAPI is available
if (typeof window !== 'undefined' && window.electronAPI) {
  console.log('✅ electronAPI is available');
  console.log('📋 Available methods:', Object.keys(window.electronAPI));
  
  // Test 2: Check if git API is available
  if (window.electronAPI.git) {
    console.log('✅ git API is available');
    console.log('📋 Git methods:', Object.keys(window.electronAPI.git));
    
    // Test 3: Try to call listProjectRepos
    window.electronAPI.git.listProjectRepos('test-project-123')
      .then(repos => {
        console.log('✅ listProjectRepos works!', repos);
        
        if (repos && repos.length > 0) {
          // Test 4: Try to get repo state
          return window.electronAPI.git.getRepoState(repos[0].id);
        }
        return null;
      })
      .then(state => {
        if (state) {
          console.log('✅ getRepoState works!', state);
        }
        console.log('🎉 All tests passed! Git monitoring integration is working.');
      })
      .catch(error => {
        console.error('❌ Test failed:', error);
      });
  } else {
    console.error('❌ git API not available in electronAPI');
  }
} else {
  console.error('❌ electronAPI not available - not in Electron environment');
}