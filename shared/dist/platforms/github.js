/**
 * GitHub platform connector (Discussions + Comments)
 */
import { executeWithPolicy, isCircuitOpen } from './base.js';
async function executeGitHub(action, config) {
    const creds = config.credentials.github;
    if (!creds) {
        return {
            success: false,
            platform: 'github',
            actionType: action.actionType,
            error: 'No GitHub credentials configured',
            retryable: false,
            timestamp: new Date().toISOString(),
        };
    }
    const { token, owner, repo } = creds;
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
    };
    if (action.actionType === 'discussion') {
        return createDiscussion(action, { owner, repo, headers });
    }
    else if (action.actionType === 'comment' && action.parentId) {
        return addDiscussionComment(action, { owner, repo, headers });
    }
    else {
        return {
            success: false,
            platform: 'github',
            actionType: action.actionType,
            error: `Unsupported action type: ${action.actionType}`,
            retryable: false,
            timestamp: new Date().toISOString(),
        };
    }
}
/**
 * Create a GitHub Discussion (requires GraphQL)
 */
async function createDiscussion(action, ctx) {
    // First, get repository ID and category ID
    const repoQuery = `
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        id
        discussionCategories(first: 10) {
          nodes { id name }
        }
      }
    }
  `;
    const repoRes = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: ctx.headers,
        body: JSON.stringify({
            query: repoQuery,
            variables: { owner: ctx.owner, repo: ctx.repo },
        }),
    });
    const repoData = await repoRes.json();
    if (repoData.errors || !repoData.data?.repository) {
        return {
            success: false,
            platform: 'github',
            actionType: 'discussion',
            error: repoData.errors?.[0]?.message || 'Failed to fetch repository',
            retryable: false,
            timestamp: new Date().toISOString(),
        };
    }
    const repository = repoData.data.repository;
    // Use "General" or "Announcements" category, fallback to first
    const category = repository.discussionCategories.nodes.find(c => c.name === 'Announcements' || c.name === 'General') || repository.discussionCategories.nodes[0];
    if (!category) {
        return {
            success: false,
            platform: 'github',
            actionType: 'discussion',
            error: 'No discussion categories found in repository',
            retryable: false,
            timestamp: new Date().toISOString(),
        };
    }
    // Create discussion
    const createQuery = `
    mutation($input: CreateDiscussionInput!) {
      createDiscussion(input: $input) {
        discussion { id number url title }
      }
    }
  `;
    const createRes = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: ctx.headers,
        body: JSON.stringify({
            query: createQuery,
            variables: {
                input: {
                    repositoryId: repository.id,
                    categoryId: category.id,
                    title: action.title || 'Update',
                    body: action.content,
                },
            },
        }),
    });
    const createData = await createRes.json();
    if (createData.errors || !createData.data?.createDiscussion) {
        return {
            success: false,
            platform: 'github',
            actionType: 'discussion',
            error: createData.errors?.[0]?.message || 'Failed to create discussion',
            retryable: false,
            timestamp: new Date().toISOString(),
        };
    }
    const discussion = createData.data.createDiscussion.discussion;
    return {
        success: true,
        platform: 'github',
        actionType: 'discussion',
        postId: String(discussion.number),
        postUrl: discussion.url,
        retryable: false,
        timestamp: new Date().toISOString(),
    };
}
/**
 * Add a comment to a discussion
 */
async function addDiscussionComment(action, ctx) {
    const commentQuery = `
    mutation($input: AddDiscussionCommentInput!) {
      addDiscussionComment(input: $input) {
        comment { id url }
      }
    }
  `;
    const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: ctx.headers,
        body: JSON.stringify({
            query: commentQuery,
            variables: {
                input: {
                    discussionId: action.parentId,
                    body: action.content,
                },
            },
        }),
    });
    const data = await res.json();
    if (data.errors || !data.data?.addDiscussionComment) {
        return {
            success: false,
            platform: 'github',
            actionType: 'comment',
            error: data.errors?.[0]?.message || 'Failed to add comment',
            retryable: false,
            timestamp: new Date().toISOString(),
        };
    }
    const comment = data.data.addDiscussionComment.comment;
    return {
        success: true,
        platform: 'github',
        actionType: 'comment',
        postId: comment.id,
        postUrl: comment.url,
        retryable: false,
        timestamp: new Date().toISOString(),
    };
}
export async function postToGitHub(action, config) {
    if (await isCircuitOpen(config.storeDb, 'github')) {
        return {
            success: false,
            platform: 'github',
            actionType: action.actionType,
            error: 'Circuit breaker open - platform temporarily disabled',
            retryable: false,
            timestamp: new Date().toISOString(),
        };
    }
    return executeWithPolicy(action, config, executeGitHub);
}
//# sourceMappingURL=github.js.map