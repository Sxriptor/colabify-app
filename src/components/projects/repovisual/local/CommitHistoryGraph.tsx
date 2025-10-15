'use client'

import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { GitHubCommit } from '../types'

interface CommitNode extends d3.SimulationNodeDatum {
  id: string
  sha: string
  message: string
  author: string
  email: string
  date: Date
  avatar?: string
  branch?: string
  parents: string[]
  children: string[]
  additions?: number
  deletions?: number
}

interface CommitLink extends d3.SimulationLinkDatum<CommitNode> {
  source: CommitNode
  target: CommitNode
}

interface CommitHistoryGraphProps {
  commits: GitHubCommit[]
  branches?: any[]
}

export function CommitHistoryGraph({ commits, branches = [] }: CommitHistoryGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [selectedCommit, setSelectedCommit] = useState<CommitNode | null>(null)
  const [dimensions, setDimensions] = useState({ width: 1200, height: 700 })

  useEffect(() => {
    if (!svgRef.current || commits.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const { width, height } = dimensions
    const margin = { top: 40, right: 40, bottom: 40, left: 40 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    // Filter out any undefined/null commits before processing
    const validCommits = commits.filter(commit => commit && commit.sha)

    // Create commit nodes with activity data
    const nodes: CommitNode[] = validCommits.map((commit, index) => ({
      id: commit.sha,
      sha: commit.sha,
      message: commit.commit.message.split('\n')[0],
      author: commit.commit.author.name,
      email: commit.commit.author.email,
      date: new Date(commit.commit.author.date),
      avatar: commit.author?.avatar_url,
      parents: [],
      children: [],
      additions: commit.stats?.additions || 0,
      deletions: commit.stats?.deletions || 0,
      x: 0,
      y: 0
    }))

    // Create links (parent-child relationships)
    const links: CommitLink[] = []
    const nodeMap = new Map(nodes.map(n => [n.sha, n]))

    // Build parent-child relationships
    validCommits.forEach((commit, index) => {
      if (index < validCommits.length - 1) {
        const source = nodeMap.get(commit.sha)
        const target = nodeMap.get(validCommits[index + 1].sha)
        if (source && target) {
          links.push({ source, target })
          source.parents.push(target.sha)
          target.children.push(source.sha)
        }
      }
    })

    // Create main group
    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Add definitions for gradients and filters
    const defs = svg.append('defs')
    
    // Glow filter for nodes
    const filter = defs.append('filter')
      .attr('id', 'glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%')

    filter.append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'coloredBlur')

    const feMerge = filter.append('feMerge')
    feMerge.append('feMergeNode').attr('in', 'coloredBlur')
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    // Gradient for links
    const linkGradient = defs.append('linearGradient')
      .attr('id', 'linkGradient')
      .attr('gradientUnits', 'userSpaceOnUse')

    linkGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#00e0ff')
      .attr('stop-opacity', 0.6)

    linkGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#a855f7')
      .attr('stop-opacity', 0.3)

    // Organic grid pattern
    const pattern = defs.append('pattern')
      .attr('id', 'organicGrid')
      .attr('width', 40)
      .attr('height', 40)
      .attr('patternUnits', 'userSpaceOnUse')

    pattern.append('circle')
      .attr('cx', 20)
      .attr('cy', 20)
      .attr('r', 0.5)
      .attr('fill', '#1a1f2e')
      .attr('opacity', 0.3)

    g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'url(#organicGrid)')

    // Create force simulation with organic movement
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<CommitNode, CommitLink>(links)
        .id(d => d.id)
        .distance(120)
        .strength(0.5))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(innerWidth / 2, innerHeight / 2))
      .force('collision', d3.forceCollide().radius(40))
      .alphaDecay(0.02)

    // Draw links with bezier curves
    const link = g.append('g')
      .selectAll('path')
      .data(links)
      .join('path')
      .attr('stroke', 'url(#linkGradient)')
      .attr('stroke-width', 2)
      .attr('fill', 'none')
      .attr('opacity', 0)
      .transition()
      .duration(2000)
      .attr('opacity', 0.6)

    // Draw nodes
    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .attr('opacity', 0)
      .call(d3.drag<SVGGElement, CommitNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any)

    // Animate nodes in
    node.transition()
      .delay((d, i) => i * 50)
      .duration(1000)
      .attr('opacity', 1)

    // Node outer glow circle
    node.append('circle')
      .attr('r', 0)
      .attr('fill', 'none')
      .attr('stroke', d => {
        const activity = (d.additions || 0) + (d.deletions || 0)
        return activity > 100 ? '#a855f7' : activity > 50 ? '#00e0ff' : '#22c55e'
      })
      .attr('stroke-width', 2)
      .attr('opacity', 0.3)
      .transition()
      .duration(1500)
      .attr('r', 20)

    // Node main circle
    node.append('circle')
      .attr('r', 0)
      .attr('fill', d => {
        const activity = (d.additions || 0) + (d.deletions || 0)
        return activity > 100 ? '#a855f7' : activity > 50 ? '#00e0ff' : '#22c55e'
      })
      .attr('stroke', d => {
        const activity = (d.additions || 0) + (d.deletions || 0)
        return activity > 100 ? '#7c3aed' : activity > 50 ? '#0891b2' : '#16a34a'
      })
      .attr('stroke-width', 2)
      .attr('filter', 'url(#glow)')
      .transition()
      .duration(1000)
      .attr('r', d => {
        const activity = (d.additions || 0) + (d.deletions || 0)
        return activity > 100 ? 12 : activity > 50 ? 10 : 8
      })

    // Node labels with fade in
    node.append('text')
      .text(d => d.message.substring(0, 25) + (d.message.length > 25 ? '...' : ''))
      .attr('x', 18)
      .attr('y', 4)
      .attr('font-size', '11px')
      .attr('fill', '#94a3b8')
      .attr('font-family', 'ui-monospace, monospace')
      .attr('opacity', 0)
      .transition()
      .delay(1000)
      .duration(800)
      .attr('opacity', 0.8)

    // Update positions on simulation tick with smooth bezier curves
    simulation.on('tick', () => {
      link.attr('d', d => {
        const source = d.source as CommitNode
        const target = d.target as CommitNode
        const dx = target.x! - source.x!
        const dy = target.y! - source.y!
        const dr = Math.sqrt(dx * dx + dy * dy) * 1.5
        return `M${source.x},${source.y}A${dr},${dr} 0 0,1 ${target.x},${target.y}`
      })

      node.attr('transform', d => `translate(${d.x},${d.y})`)
    })

    // Node interactions with smooth animations
    node.on('click', (event, d: CommitNode) => {
      setSelectedCommit(d)
      
      // Pulse effect on click
      const activity = (d.additions || 0) + (d.deletions || 0)
      d3.select(event.currentTarget)
        .select('circle:nth-child(2)')
        .transition()
        .duration(300)
        .attr('r', activity > 100 ? 16 : activity > 50 ? 14 : 12)
        .transition()
        .duration(300)
        .attr('r', activity > 100 ? 12 : activity > 50 ? 10 : 8)
    })

    node.on('mouseenter', function(event, d: CommitNode) {
      // Grow main circle
      d3.select(this).select('circle:nth-child(2)')
        .transition()
        .duration(400)
        .ease(d3.easeElastic)
        .attr('r', () => {
          const activity = (d.additions || 0) + (d.deletions || 0)
          return activity > 100 ? 16 : activity > 50 ? 14 : 12
        })

      // Brighten glow
      d3.select(this).select('circle:nth-child(1)')
        .transition()
        .duration(400)
        .attr('opacity', 0.6)
        .attr('r', 28)

      // Brighten label
      d3.select(this).select('text')
        .transition()
        .duration(300)
        .attr('opacity', 1)
        .attr('fill', '#e2e8f0')
    })

    node.on('mouseleave', function(event, d: CommitNode) {
      // Return to normal size
      d3.select(this).select('circle:nth-child(2)')
        .transition()
        .duration(400)
        .ease(d3.easeElastic)
        .attr('r', () => {
          const activity = (d.additions || 0) + (d.deletions || 0)
          return activity > 100 ? 12 : activity > 50 ? 10 : 8
        })

      // Dim glow
      d3.select(this).select('circle:nth-child(1)')
        .transition()
        .duration(400)
        .attr('opacity', 0.3)
        .attr('r', 20)

      // Dim label
      d3.select(this).select('text')
        .transition()
        .duration(300)
        .attr('opacity', 0.8)
        .attr('fill', '#94a3b8')
    })

    function dragstarted(event: any, d: CommitNode) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    }

    function dragged(event: any, d: CommitNode) {
      d.fx = event.x
      d.fy = event.y
    }

    function dragended(event: any, d: CommitNode) {
      if (!event.active) simulation.alphaTarget(0)
      d.fx = null
      d.fy = null
    }

    return () => {
      simulation.stop()
    }
  }, [commits, dimensions])

  return (
    <div className="border border-gray-800/50 bg-gradient-to-br from-[#050509] via-[#0a0f1a] to-[#050509] rounded-lg overflow-hidden">
      <div className="border-b border-gray-800/50 p-5 flex items-center justify-between bg-black/40 backdrop-blur-sm">
        <div>
          <h3 className="text-transparent bg-clip-text bg-gradient-to-r from-[#00e0ff] to-[#a855f7] font-mono text-sm font-semibold tracking-wide">
            COMMIT HISTORY GARDEN
          </h3>
          <p className="text-gray-500 font-mono text-xs mt-1">
            {commits.length} commits • Interactive force-directed graph
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-xs font-mono">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 rounded-full bg-[#22c55e]"></div>
              <span className="text-gray-500">Small</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 rounded-full bg-[#00e0ff]"></div>
              <span className="text-gray-500">Medium</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 rounded-full bg-[#a855f7]"></div>
              <span className="text-gray-500">Large</span>
            </div>
          </div>
          <button
            onClick={() => setDimensions({ width: 1200, height: 700 })}
            className="px-3 py-1.5 bg-gray-900/50 text-gray-400 font-mono text-xs hover:bg-gray-800/50 hover:text-gray-300 border border-gray-700/50 rounded transition-all duration-300"
          >
            RESET VIEW
          </button>
        </div>
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="bg-gradient-to-br from-[#050509] via-[#0a0f1a] to-[#050509]"
        />

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
                <span className="text-[#00e0ff] font-semibold">{selectedCommit.sha.substring(0, 8)}</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-gray-500 min-w-[60px]">Author:</span>
                <span className="text-gray-300">{selectedCommit.author}</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-gray-500 min-w-[60px]">Email:</span>
                <span className="text-gray-400 text-[10px]">{selectedCommit.email}</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-gray-500 min-w-[60px]">Date:</span>
                <span className="text-gray-400">{selectedCommit.date.toLocaleString()}</span>
              </div>
              {(selectedCommit.additions || selectedCommit.deletions) && (
                <div className="flex items-start space-x-2">
                  <span className="text-gray-500 min-w-[60px]">Changes:</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-[#22c55e]">+{selectedCommit.additions || 0}</span>
                    <span className="text-[#ef4444]">-{selectedCommit.deletions || 0}</span>
                  </div>
                </div>
              )}
              <div className="pt-2 border-t border-gray-800/50">
                <span className="text-gray-500 block mb-1">Message:</span>
                <p className="text-gray-300 leading-relaxed">{selectedCommit.message}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
