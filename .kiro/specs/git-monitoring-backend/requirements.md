# Requirements Document

## Introduction

This feature implements the backend Git monitoring system for an existing Electron application that already has project management and watch toggle functionality. The system monitors Git repositories when watching is enabled and generates real-time activity events that feed into the frontend activity area. The backend focuses on detecting and reporting essential Git operations like branch changes, commits, pushes, merges, and remote updates while maintaining a lightweight, efficient architecture.

## Requirements

### Requirement 1

**User Story:** As a backend system, I want to monitor Git repository file system changes, so that I can detect local Git activities in real-time.

#### Acceptance Criteria

1. WHEN watching is enabled for a project THEN the system SHALL monitor .git/HEAD, .git/index, and .git/refs/** files using file system watchers
2. WHEN Git-related files change THEN the system SHALL debounce events by 300-500ms to avoid spam
3. WHEN file changes are detected THEN the system SHALL read current repository state and compare with previous state
4. WHEN the system starts THEN it SHALL restore monitoring for projects that were previously being watched

### Requirement 2

**User Story:** As a backend system, I want to perform periodic remote repository checks, so that I can detect remote updates and push activities.

#### Acceptance Criteria

1. WHEN a project is being watched AND has a remote URL THEN the system SHALL perform git fetch every 120 seconds
2. WHEN fetch operations complete THEN the system SHALL compare remote branch lists and ahead/behind status with previous state
3. WHEN fetch operations fail THEN the system SHALL log errors but continue monitoring without crashing
4. WHEN no remote URL is configured THEN the system SHALL skip fetch operations for that repository

### Requirement 3

**User Story:** As an activity tracking system, I want to detect and classify local Git activities, so that I can generate appropriate activity events for the frontend.

#### Acceptance Criteria

1. WHEN a new local branch is created THEN the system SHALL emit a BRANCH_CREATED event with local scope and branch name
2. WHEN the current branch changes THEN the system SHALL emit a BRANCH_SWITCH event with from and to branch names
3. WHEN a commit is made on the current branch THEN the system SHALL emit a COMMIT event with branch, commit hash, author, and subject
4. WHEN a merge commit is detected THEN the system SHALL emit a MERGE event with branch, commit hash, and parent count
5. WHEN working tree files are modified without other Git activities THEN the system SHALL emit a WORKTREE_CHANGE event

### Requirement 4

**User Story:** As an activity tracking system, I want to detect remote repository changes and push activities, so that I can report team collaboration events.

#### Acceptance Criteria

1. WHEN a periodic fetch detects new remote branches THEN the system SHALL emit a BRANCH_CREATED event with remote scope
2. WHEN the ahead/behind status changes after a fetch THEN the system SHALL emit a REMOTE_UPDATE event
3. WHEN a push is detected through reflog analysis THEN the system SHALL emit a PUSH event within one polling cycle
4. WHEN remote HEAD changes after fetch THEN the system SHALL include this information in REMOTE_UPDATE events

### Requirement 5

**User Story:** As a Git state management system, I want to efficiently read and cache repository information, so that I can quickly detect changes and provide current status.

#### Acceptance Criteria

1. WHEN reading Git information THEN the system SHALL use lightweight Git commands without shell interpolation
2. WHEN repository state is read THEN the system SHALL return current branch, HEAD commit, status summary, upstream info, and ahead/behind counts
3. WHEN repository state changes THEN the system SHALL update and persist the last known state to JSON storage
4. WHEN Git commands fail THEN the system SHALL handle errors gracefully and continue monitoring

### Requirement 6

**User Story:** As an Electron main process service, I want to provide IPC interfaces for Git monitoring, so that the renderer can control monitoring and receive activity events.

#### Acceptance Criteria

1. WHEN the renderer calls git:watchProject THEN the main process SHALL start or stop project watching based on the boolean parameter
2. WHEN the renderer calls git:listProjectRepos THEN the main process SHALL return repository configurations and their last known states
3. WHEN the renderer calls git:getRepoState THEN the main process SHALL return current state for the specified repository
4. WHEN Git activities occur THEN the main process SHALL send events to the renderer via the git:event channel with activity details
5. WHEN errors occur during Git operations THEN the main process SHALL send error events to the renderer

### Requirement 7

**User Story:** As a performance-conscious system, I want to minimize resource usage while maintaining responsive monitoring, so that the application remains efficient.

#### Acceptance Criteria

1. WHEN file system events occur THEN the system SHALL debounce them by 300-500ms to prevent event spam
2. WHEN performing Git operations THEN the system SHALL use fast, minimal Git commands without heavy parsing
3. WHEN storing repository data THEN the system SHALL use a simple JSON file in the app's userData directory
4. WHEN monitoring multiple repositories THEN the system SHALL use efficient file watchers and avoid blocking operations
5. WHEN polling remote repositories THEN the system SHALL limit fetch operations to every 120 seconds maximum