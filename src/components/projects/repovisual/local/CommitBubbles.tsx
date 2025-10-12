'use client'

import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { GitHubCommit } from '../types'

interface CommitData {
  name: string
  value: number
  sha: string
  author: string
  email: string
  date: string
  additions: number
  deletions: number
}

interface HierarchyData {
  name: string
  value?: number
  children?: CommitData[]
}

interface CommitBubblesProps {
  commits: GitHubCommit[]
}

export function CommitBubbles({ commits }: CommitBubblesProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selectedCommit, setSelectedCommit] = useState<CommitData | null>(null)
  const [layoutType, setLayoutType] = useState<'pack' | 'cluster'>('pack')

  // Get unique authors and assign colors
  const authors = Array.from(new Set(commits.map(c => c.commit.author.name)))
  const authorColors = [
    '#dc2626', // dark red
    '#2563eb', // blue
    '#7c3aed', // purple
    '#f5f5f5', // white
    '#ea580c', // orange
  ]
  const getAuthorColor = (author: string) => {
    const index = authors.indexOf(author)
    return authorColors[index % authorColors.length]
  }

  useEffect(() => {
    if (!svgRef.current || commits.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = 1200
    const height = 700

    // Prepare hierarchical data
    let hierarchyData: HierarchyData

    if (layoutType === 'pack') {
      // For pack layout, use flat structure
      hierarchyData = {
        name: 'repository',
        children: commits.map(commit => ({
          name: commit.commit.message.split('\n')[0],
          value: (commit.stats?.additions || 0) + (commit.stats?.deletions || 0) + 10,
          sha: commit.sha,
          author: commit.commit.author.name,
          email: commit.commit.author.email,
          date: commit.commit.author.date,
          additions: commit.stats?.additions || 0,
          deletions: commit.stats?.deletions || 0
        }))
      }
    } else {
      // For cluster layout, create a tree structure by author
      const authorGroups = d3.group(commits, d => d.commit.author.name)
      
      hierarchyData = {
        name: 'repository',
        children: Array.from(authorGroups, ([author, authorCommits]) => ({
          name: author,
          value: 1,
          sha: '',
          author: author,
          email: '',
          date: '',
          additions: 0,
          deletions: 0,
          children: authorCommits.map(commit => ({
            name: commit.commit.message.split('\n')[0],
            value: (commit.stats?.additions || 0) + (commit.stats?.deletions || 0) + 10,
            sha: commit.sha,
            author: commit.commit.author.name,
            email: commit.commit.author.email,
            date: commit.commit.author.date,
            additions: commit.stats?.additions || 0,
            deletions: commit.stats?.deletions || 0
          }))
        }))
      }
    }

    const root = d3.hierarchy<HierarchyData>(hierarchyData)
      .sum(d => d.value || 0)

    let nodes: any[]

    if (layoutType === 'pack') {
      // Create pack layout
      const pack = d3.pack<HierarchyData>()
        .size([width - 40, height - 40])
        .padding(3)

      nodes = pack(root).descendants().slice(1) // Skip root
    } else {
      // Create cluster layout (dendrogram)
      const cluster = d3.cluster<HierarchyData>()
        .size([height - 120, width - 500]) // Leave more space for labels
        .separation((a, b) => a.parent === b.parent ? 1.5 : 2.5)

      cluster(root)
      const clusterNodes = root.descendants()
      
      // Adjust positions and add radius for cluster (rotate 90 degrees)
      nodes = clusterNodes.map(node => {
        const data = node.data as any
        const isLeaf = !node.children
        return {
          ...node,
          x: node.y! + 80, // Swap x and y for horizontal layout, more left margin
          y: node.x! + 60,
          r: isLeaf ? (data.additions + data.deletions > 50 ? 8 : 6) : 6 // Slightly larger for parent nodes
        }
      })
    }

    // Add definitions for gradients and filters
    const defs = svg.append('defs')
    
    // Glow filter
    const filter = defs.append('filter')
      .attr('id', 'bubbleGlow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%')

    filter.append('feGaussianBlur')
      .attr('stdDeviation', '4')
      .attr('result', 'coloredBlur')

    const feMerge = filter.append('feMerge')
    feMerge.append('feMergeNode').attr('in', 'coloredBlur')
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Create main group
    const g = svg.append('g')
      .attr('transform', 'translate(20,20)')

    // Draw links for cluster layout
    if (layoutType === 'cluster') {
      const links = root.links()
      
      g.selectAll('path.link')
        .data(links)
        .join('path')
        .attr('class', 'link')
        .attr('d', d => {
          const source = nodes.find(n => n.data === d.source.data)
          const target = nodes.find(n => n.data === d.target.data)
          if (!source || !target) return ''
          
          // Create curved path for better tree visualization
          const dx = target.x - source.x
          const dy = target.y - source.y
          return `M${source.x},${source.y}C${source.x + dx/2},${source.y} ${source.x + dx/2},${target.y} ${target.x},${target.y}`
        })
        .attr('fill', 'none')
        .attr('stroke', d => {
          const targetData = d.target.data as any
          if (targetData.author && targetData.sha) { // Only color leaf nodes (actual commits)
            return getAuthorColor(targetData.author)
          }
          return '#64748b'
        })
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.6)
        .attr('stroke-dasharray', '0, 1000')
        .transition()
        .duration(1500)
        .attr('stroke-dasharray', '1000, 0')
    }

    // Draw circles
    const circles = g.selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', 0)
      .attr('fill', d => {
        const data = d.data as any
        if (layoutType === 'cluster' && !data.sha) {
          // Parent nodes (author groups) - use gray
          return '#64748b'
        }
        return getAuthorColor(data.author)
      })
      .attr('fill-opacity', 0.8)
      .attr('stroke', d => {
        const data = d.data as any
        if (layoutType === 'cluster' && !data.sha) {
          return '#475569'
        }
        const color = getAuthorColor(data.author)
        return d3.color(color)?.darker(0.5).toString() || color
      })
      .attr('stroke-width', 2)
      .attr('filter', 'url(#bubbleGlow)')
      .attr('cursor', 'pointer')

    // Animate circles in
    circles.transition()
      .delay((d, i) => i * 20)
      .duration(1000)
      .ease(d3.easeElastic)
      .attr('r', d => d.r)

    // Add labels - different logic for pack vs cluster
    let labelNodes = nodes
    if (layoutType === 'pack') {
      labelNodes = nodes.filter(d => d.r > 30)
    } else {
      // For cluster, show labels for all nodes (both author groups and commits)
      labelNodes = nodes
    }

    const labels = g.selectAll('text')
      .data(labelNodes)
      .join('text')
      .attr('x', d => {
        if (layoutType === 'cluster') {
          // Position labels to the right of nodes in cluster view
          return d.x + 15
        }
        return d.x
      })
      .attr('y', d => d.y)
      .attr('text-anchor', layoutType === 'cluster' ? 'start' : 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', d => {
        if (layoutType === 'cluster') {
          const data = d.data as any
          // Different colors for author groups vs commits
          return data.sha ? '#e2e8f0' : '#94a3b8'
        }
        return '#e2e8f0'
      })
      .attr('font-family', 'ui-monospace, monospace')
      .attr('font-size', d => {
        if (layoutType === 'cluster') {
          const data = d.data as any
          // Larger font for author groups
          return data.sha ? '10px' : '12px'
        }
        return Math.min(d.r / 3, 12) + 'px'
      })
      .attr('font-weight', d => {
        if (layoutType === 'cluster') {
          const data = d.data as any
          // Bold for author groups
          return data.sha ? '500' : '700'
        }
        return '500'
      })
      .attr('pointer-events', 'none')
      .attr('opacity', 0)
      .text(d => {
        const data = d.data as CommitData
        if (layoutType === 'cluster') {
          if (!data.sha) {
            // Author group - show author name
            return data.name.toUpperCase()
          } else {
            // Commit - show shorter commit messages
            const maxLength = 40
            const text = data.name
            return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
          }
        } else {
          const maxLength = Math.floor(d.r / 4)
          const text = data.name
          return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
        }
      })

    // Fade in labels
    labels.transition()
      .delay(1000)
      .duration(800)
      .attr('opacity', 0.9)

    // Interactions
    circles.on('click', (event, d) => {
      setSelectedCommit(d.data as CommitData)
    })

    circles.on('mouseenter', function(event, d) {
      d3.select(this)
        .transition()
        .duration(300)
        .ease(d3.easeElastic)
        .attr('r', d.r * 1.1)
        .attr('fill-opacity', 1)
        .attr('stroke-width', 3)
    })

    circles.on('mouseleave', function(event, d) {
      d3.select(this)
        .transition()
        .duration(300)
        .ease(d3.easeElastic)
        .attr('r', d.r)
        .attr('fill-opacity', 0.7)
        .attr('stroke-width', 2)
    })

  }, [commits, layoutType])

  return (
    <div className="border border-gray-800/50 bg-gradient-to-br from-[#050509] via-[#0a0f1a] to-[#050509] rounded-lg overflow-hidden">
      <div className="border-b border-gray-800/50 p-5 flex items-center justify-between bg-black/40 backdrop-blur-sm">
        <div>
          <h3 className="text-white font-mono text-sm font-semibold tracking-wide">
            COMMIT GARDEN
          </h3>
          <p className="text-gray-500 font-mono text-xs mt-1">
            {commits.length} commits • Circle size = code changes • Color = author
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Layout Toggle */}
          <div className="flex items-center space-x-2 border border-gray-700 rounded-md p-1">
            <button
              onClick={() => setLayoutType('pack')}
              className={`px-3 py-1 text-xs font-mono rounded transition-all duration-200 ${
                layoutType === 'pack'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              PACK
            </button>
            <button
              onClick={() => setLayoutType('cluster')}
              className={`px-3 py-1 text-xs font-mono rounded transition-all duration-200 ${
                layoutType === 'cluster'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              CLUSTER
            </button>
          </div>
          
          {/* Author Legend */}
          <div className="flex items-center space-x-3 text-xs font-mono">
            {authors.slice(0, 5).map((author, index) => (
              <div key={author} className="flex items-center space-x-1.5">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: authorColors[index % authorColors.length] }}
                ></div>
                <span className="text-gray-400 truncate max-w-[100px]">{author}</span>
              </div>
            ))}
            {authors.length > 5 && (
              <span className="text-gray-500">+{authors.length - 5} more</span>
            )}
          </div>
        </div>
      </div>

      <div className="relative p-6 overflow-auto">
        {layoutType === 'cluster' && (
          <div className="absolute top-2 right-2 text-xs text-gray-500 font-mono bg-black/50 px-2 py-1 rounded border border-gray-700/50 z-10">
            ← SCROLL HORIZONTALLY →
          </div>
        )}
        <div className="min-w-[1200px]">
          <svg
            ref={svgRef}
            width={1200}
            height={700}
            className="bg-gradient-to-br from-[#050509] via-[#0a0f1a] to-[#050509]"
          />
        </div>

        {selectedCommit && (
          <div className="absolute top-6 right-6 bg-gradient-to-br from-gray-900/95 to-gray-950/95 backdrop-blur-md border border-gray-700/50 rounded-lg p-5 max-w-md shadow-2xl animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-transparent bg-clip-text bg-gradient-to-r from-[#00e0ff] to-[#a855f7] font-mono text-xs font-semibold tracking-wide">
                COMMIT DETAILS
              </h4>
              <button
                onClick={() => setSelectedCommit(null)}
                className="text-gray-500 hover:text-gray-300 transition-colors duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-3 text-xs font-mono">
              <div className="flex items-start space-x-2">
                <span className="text-gray-500 min-w-[60px]">SHA:</span>
                <span className="text-[#00e0ff] font-semibold">{selectedCommit.sha?.substring(0, 8)}</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-gray-500 min-w-[60px]">Author:</span>
                <span className="text-gray-300">{selectedCommit.author}</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-gray-500 min-w-[60px]">Date:</span>
                <span className="text-gray-400">{new Date(selectedCommit.date).toLocaleString()}</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-gray-500 min-w-[60px]">Changes:</span>
                <div className="flex items-center space-x-2">
                  <span className="text-[#22c55e]">+{selectedCommit.additions || 0}</span>
                  <span className="text-[#ef4444]">-{selectedCommit.deletions || 0}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-gray-800/50">
                <span className="text-gray-500 block mb-1">Message:</span>
                <p className="text-gray-300 leading-relaxed">{selectedCommit.name}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
