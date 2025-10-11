# Implementation Plan

- [ ] 1. Set up project structure and core interfaces
  - Create directory structure for Git monitoring backend components
  - Define TypeScript interfaces and types in shared/types.ts
  - Set up module exports and basic project organization
  - _Requirements: 5.1, 5.2, 5.3_

- [ ] 2. Implement Git command execution utilities
  - [ ] 2.1 Create safe Git command executor
    - Write util/gitExec.ts with safe subprocess spawning
    - Implement error handling and timeout management for Git commands
    - Add validation to prevent shell injection attacks
    - _Requirements: 5.4, 7.2_

  - [ ] 2.2 Implement Git state reading service
    - Write services/GitState.ts with lightweight Git information readers
    - Implement methods for branch, head, status, upstream, and commit metadata
    - Add branch listing and merge detection functionality
    - _Requirements: 5.1, 5.2, 7.2_

  - [ ]* 2.3 Write unit tests for Git utilities
    - Create tests for Git command execution with mocked outputs
    - Test Git state parsing with various repository scenarios
    - Verify error handling for invalid Git commands
    - _Requirements: 5.4, 7.2_

- [ ] 3. Create repository state management and storage
  - [ ] 3.1 Implement JSON-based repository store
    - Write store/RepoStore.ts with JSON file persistence
    - Implement CRUD operations for repository configurations
    - Add methods to save and load last known repository states
    - _Requirements: 5.3, 7.4_

  - [ ] 3.2 Add repository state comparison logic
    - Implement state diffing to detect changes between repository states
    - Create helper functions to identify specific types of Git activities
    - Add validation for repository state data integrity
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 3.3 Write unit tests for state management
    - Test JSON persistence and retrieval operations
    - Verify state comparison logic with various change scenarios
    - Test error handling for corrupted or missing state files
    - _Requirements: 5.3, 7.4_

- [ ] 4. Implement file system monitoring for Git repositories
  - [ ] 4.1 Create GitWatcher for individual repository monitoring
    - Write services/GitWatcher.ts with chokidar file system watching
    - Implement debounced event handling for .git directory changes
    - Add start/stop methods for repository monitoring lifecycle
    - _Requirements: 1.1, 1.2, 1.3, 7.1_

  - [ ] 4.2 Add Git activity detection and event generation
    - Implement change detection logic for branch switches, commits, and merges
    - Create activity event generation based on repository state changes
    - Add worktree change detection for file modifications
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 4.3 Write integration tests for file monitoring
    - Test file watcher behavior with real Git repository changes
    - Verify debouncing effectiveness with rapid file system events
    - Test activity event generation for various Git operations
    - _Requirements: 1.1, 1.2, 1.3, 7.1_

- [ ] 5. Implement project-level monitoring and remote polling
  - [ ] 5.1 Create ProjectWatcher for coordinating multiple repositories
    - Write services/ProjectWatcher.ts to manage multiple GitWatchers
    - Implement project-level start/stop functionality for repository monitoring
    - Add repository addition and removal methods for dynamic management
    - _Requirements: 1.4, 2.1, 2.2_

  - [ ] 5.2 Add periodic remote repository polling
    - Implement 120-second interval fetching for repositories with remote URLs
    - Add remote branch detection and ahead/behind status monitoring
    - Create push detection logic using Git reflog analysis
    - _Requirements: 2.1, 2.2, 4.1, 4.2, 4.3_

  - [ ]* 5.3 Write integration tests for project monitoring
    - Test ProjectWatcher coordination of multiple GitWatchers
    - Verify remote polling behavior with actual Git repositories
    - Test push detection accuracy with reflog analysis
    - _Requirements: 2.1, 2.2, 4.1, 4.2_

- [ ] 6. Create IPC communication layer
  - [ ] 6.1 Implement Git monitoring IPC handlers
    - Write main/ipc/GitIPC.ts with IPC method handlers
    - Implement git:watchProject, git:listProjectRepos, and git:getRepoState methods
    - Add git:connectRepoToProject method for dynamic repository addition
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 6.2 Add event emission system for activity updates
    - Implement git:event channel for sending activities to renderer process
    - Create event payload formatting for different activity types
    - Add error event handling and propagation to frontend
    - _Requirements: 6.4, 6.5_

  - [ ]* 6.3 Write IPC communication tests
    - Test IPC method handlers with mocked Electron IPC
    - Verify event emission and payload formatting
    - Test error handling and propagation through IPC layer
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 7. Integrate with main Electron process
  - [ ] 7.1 Update main process initialization
    - Modify electron/main.js to initialize Git monitoring system
    - Add automatic restoration of project watching states on app startup
    - Integrate GitIPC handlers with existing IPC infrastructure
    - _Requirements: 1.4, 6.1_

  - [ ] 7.2 Add project watch state synchronization
    - Connect existing project watch toggle functionality to Git monitoring backend
    - Implement automatic GitWatcher startup when projects are set to watching
    - Add cleanup and resource management for stopped watchers
    - _Requirements: 1.4, 6.1, 7.5_

  - [ ]* 7.3 Write end-to-end integration tests
    - Test complete workflow from Git operations to frontend activity events
    - Verify project watch toggle integration with monitoring system
    - Test resource cleanup and memory management
    - _Requirements: 1.4, 6.1, 6.4, 7.5_

- [ ] 8. Add error handling and performance optimization
  - [ ] 8.1 Implement comprehensive error handling
    - Add graceful degradation for Git command failures
    - Implement error recovery and retry logic for transient failures
    - Create detailed error logging and user-friendly error messages
    - _Requirements: 2.3, 5.4, 6.5_

  - [ ] 8.2 Optimize performance and resource usage
    - Implement efficient debouncing to prevent event spam
    - Add memory management for long-running watchers
    - Optimize Git command execution for minimal resource usage
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 8.3 Write performance and stress tests
    - Test system behavior with multiple repositories and high-frequency changes
    - Verify memory usage and resource cleanup over extended periods
    - Test debouncing effectiveness under various load conditions
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_