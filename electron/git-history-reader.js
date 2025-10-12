// Git History Reader - Reads complete commit history from local .git directories
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class GitHistoryReader {
  /**
   * Read complete commit history from a Git repository
   * @param {string} repoPath - Path to the Git repository
   * @param {object} options - Options for reading history
   * @returns {Promise<object>} Complete repository history
   */
  async readCompleteHistory(repoPath, options = {}) {
    const {
      maxCommits = 1000,
      includeBranches = true,
      includeRemotes = true,
      includeStats = true
    } = options;

    console.log(`📚 Reading complete Git history from: ${repoPath}`);

    try {
      // Validate Git repository
      const isGitRepo = await this.isGitRepository(repoPath);
      if (!isGitRepo) {
        throw new Error(`Not a Git repository: ${repoPath}`);
      }

      // Read all data in parallel
      const [commits, branches, remotes, contributors, tags] = await Promise.all([
        this.readCommits(repoPath, maxCommits, includeStats),
        includeBranches ? this.readBranches(repoPath) : [],
        includeRemotes ? this.readRemotes(repoPath) : {},
        this.readContributors(repoPath),
        this.readTags(repoPath)
      ]);

      const history = {
        repoPath,
        commits,
        branches,
        remotes,
        contributors,
        tags,
        stats: {
          totalCommits: commits.length,
          totalBranches: branches.length,
          totalContributors: contributors.length,
          totalTags: tags.length
        },
        readAt: new Date().toISOString()
      };

      console.log(`✅ Read ${commits.length} commits, ${branches.length} branches, ${contributors.length} contributors`);
      return history;

    } catch (error) {
      console.error(`❌ Error reading Git history from ${repoPath}:`, error);
      throw error;
    }
  }

  /**
   * Read all commits from the repository
   */
  async readCommits(repoPath, maxCommits = 1000, includeStats = true) {
    try {
      // Format: hash|author name|author email|date|subject|parent hashes
      const format = '%H|%an|%ae|%aI|%s|%P';
      const gitLog = await this.execGit(repoPath, [
        'log',
        `--max-count=${maxCommits}`,
        '--all',
        `--pretty=format:${format}`,
        '--date-order'
      ]);

      const commits = [];
      const lines = gitLog.trim().split('\n').filter(line => line);

      for (const line of lines) {
        const [hash, authorName, authorEmail, date, message, parents] = line.split('|');
        
        const commit = {
          sha: hash,
          author: {
            name: authorName,
            email: authorEmail
          },
          date,
          message,
          parents: parents ? parents.split(' ').filter(p => p) : [],
          branches: [] // Will be populated later
        };

        // Get stats if requested
        if (includeStats) {
          try {
            const stats = await this.getCommitStats(repoPath, hash);
            commit.stats = stats;
          } catch (error) {
            console.warn(`Could not get stats for commit ${hash}:`, error.message);
            commit.stats = { additions: 0, deletions: 0, files: 0 };
          }
        }

        commits.push(commit);
      }

      // Map commits to branches
      const branchCommits = await this.mapCommitsToBranches(repoPath, commits);
      commits.forEach(commit => {
        commit.branches = branchCommits[commit.sha] || [];
      });

      return commits;

    } catch (error) {
      console.error('Error reading commits:', error);
      return [];
    }
  }

  /**
   * Get statistics for a specific commit
   */
  async getCommitStats(repoPath, commitHash) {
    try {
      const stats = await this.execGit(repoPath, [
        'show',
        '--stat',
        '--format=',
        commitHash
      ]);

      const lines = stats.trim().split('\n');
      const summaryLine = lines[lines.length - 1];
      
      // Parse: "X files changed, Y insertions(+), Z deletions(-)"
      const match = summaryLine.match(/(\d+) file[s]? changed(?:, (\d+) insertion[s]?\(\+\))?(?:, (\d+) deletion[s]?\(-\))?/);
      
      if (match) {
        return {
          files: parseInt(match[1]) || 0,
          additions: parseInt(match[2]) || 0,
          deletions: parseInt(match[3]) || 0
        };
      }

      return { files: 0, additions: 0, deletions: 0 };

    } catch (error) {
      return { files: 0, additions: 0, deletions: 0 };
    }
  }

  /**
   * Read all branches from the repository
   */
  async readBranches(repoPath) {
    try {
      // Get all branches with their commit hashes
      const branchList = await this.execGit(repoPath, [
        'branch',
        '-a',
        '-v',
        '--format=%(refname:short)|%(objectname)|%(upstream:short)|%(HEAD)'
      ]);

      const branches = [];
      const lines = branchList.trim().split('\n').filter(line => line);

      for (const line of lines) {
        const [name, commit, upstream, isHead] = line.split('|');
        
        branches.push({
          name: name.trim(),
          commit: commit.trim(),
          upstream: upstream.trim() || null,
          isHead: isHead.trim() === '*',
          isRemote: name.startsWith('remotes/'),
          isLocal: !name.startsWith('remotes/')
        });
      }

      return branches;

    } catch (error) {
      console.error('Error reading branches:', error);
      return [];
    }
  }

  /**
   * Map commits to their branches
   */
  async mapCommitsToBranches(repoPath, commits) {
    try {
      const commitMap = {};

      // Get all branches
      const branches = await this.readBranches(repoPath);

      // For each branch, get its commits
      for (const branch of branches) {
        if (branch.isRemote) continue; // Skip remote branches for now

        try {
          const branchCommits = await this.execGit(repoPath, [
            'log',
            branch.name,
            '--pretty=format:%H',
            '--max-count=100'
          ]);

          const commitHashes = branchCommits.trim().split('\n').filter(h => h);

          commitHashes.forEach(hash => {
            if (!commitMap[hash]) {
              commitMap[hash] = [];
            }
            commitMap[hash].push(branch.name);
          });

        } catch (error) {
          console.warn(`Could not read commits for branch ${branch.name}:`, error.message);
        }
      }

      return commitMap;

    } catch (error) {
      console.error('Error mapping commits to branches:', error);
      return {};
    }
  }

  /**
   * Read all remotes from the repository
   */
  async readRemotes(repoPath) {
    try {
      const remoteList = await this.execGit(repoPath, ['remote', '-v']);
      const remotes = {};

      const lines = remoteList.trim().split('\n').filter(line => line);

      for (const line of lines) {
        const [name, url, type] = line.split(/\s+/);
        if (!remotes[name]) {
          remotes[name] = {};
        }
        
        if (type === '(fetch)') {
          remotes[name].fetch = url;
        } else if (type === '(push)') {
          remotes[name].push = url;
        }
      }

      return remotes;

    } catch (error) {
      console.error('Error reading remotes:', error);
      return {};
    }
  }

  /**
   * Read all contributors from the repository
   */
  async readContributors(repoPath) {
    try {
      const contributorList = await this.execGit(repoPath, [
        'shortlog',
        '-sne',
        '--all'
      ]);

      const contributors = [];
      const lines = contributorList.trim().split('\n').filter(line => line);

      for (const line of lines) {
        // Format: "    123  Author Name <email@example.com>"
        const match = line.trim().match(/^(\d+)\s+(.+?)\s+<(.+?)>$/);
        if (match) {
          contributors.push({
            commits: parseInt(match[1]),
            name: match[2],
            email: match[3]
          });
        }
      }

      return contributors.sort((a, b) => b.commits - a.commits);

    } catch (error) {
      console.error('Error reading contributors:', error);
      return [];
    }
  }

  /**
   * Read all tags from the repository
   */
  async readTags(repoPath) {
    try {
      const tagList = await this.execGit(repoPath, [
        'tag',
        '-l',
        '--format=%(refname:short)|%(objectname)|%(creatordate:iso8601)'
      ]);

      const tags = [];
      const lines = tagList.trim().split('\n').filter(line => line);

      for (const line of lines) {
        const [name, commit, date] = line.split('|');
        tags.push({
          name: name.trim(),
          commit: commit.trim(),
          date: date.trim()
        });
      }

      return tags;

    } catch (error) {
      console.error('Error reading tags:', error);
      return [];
    }
  }

  /**
   * Check if a path is a Git repository
   */
  async isGitRepository(repoPath) {
    try {
      const gitDir = path.join(repoPath, '.git');
      const stats = await fs.stat(gitDir);
      return stats.isDirectory() || stats.isFile();
    } catch (error) {
      return false;
    }
  }

  /**
   * Execute a Git command
   */
  async execGit(repoPath, args) {
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, {
        cwd: repoPath,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      git.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      git.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      git.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Git command failed: ${stderr}`));
        }
      });

      git.on('error', (error) => {
        reject(error);
      });
    });
  }
}

module.exports = { GitHistoryReader };
