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
  const [dimensions, setDimensions] = useState({ width: 1200, height: 600 })

  useEffect(() => {
    if (!svgRef.current || commits.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const { width, height } = dimensions
    const margin = { top: 20, right: 20, bottom: 20, left: 20 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    // Create commit nodes
    const nodes: CommitNode[] = commits.map((commit, index) => ({
      id: commit.sha,
      sha: commit.sha,
      message: commit.commit.message.split('\n')[0],
      author: commit.commit.author.name,
      email: commit.commit.author.email,
      date: new Date(commit.commit.author.date),
      avatar: commit.author?.avatar_url,
      parents: [],
      children: [],
      x: 0,
      y: 0
    }))

    // Create links (parent-child relationships)
    const links: CommitLink[] = []
    const nodeMap = new Map(nodes.map(n => [n.sha, n]))

    // Build parent-child relationships
    commits.forEach((commit, index) => {
      if (index < commits.length - 1) {
        const source = nodeMap.get(commit.sha)
        const target = nodeMap.get(commits[index + 1].sha)
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

    // Add grid pattern
    const defs = svg.append('defs')
    const pattern = defs.append('pattern')
      .attr('id', 'grid')
      .attr('width', 20)
      .attr('height', 20)
      .attr('patternUnits', 'userSpaceOnUse')

    pattern.append('path')
      .attr('d', 'M 20 0 L 0 0 0 20')
      .attr('fill', 'none')
      .attr('stroke', '#1f2937')
      .attr('stroke-width', 0.5)

    g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'url(#grid)')

    // Create force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<CommitNode, CommitLink>(links)
        .id(d => d.id)
        .distance(100))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(innerWidth / 2, innerHeight / 2))
      .force('collision', d3.forceCollide().radius(30))

    // Draw links
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#4b5563')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6)

    // Draw nodes
    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(d3.drag<SVGGElement, CommitNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any)

    // Node circles
    node.append('circle')
      .attr('r', 8)
      .attr('fill', '#3b82f6')
      .attr('stroke', '#1e40af')
      .attr('stroke-width', 2)

    // Node labels
    node.append('text')
      .text(d => d.message.substring(0, 30) + (d.message.length > 30 ? '...' : ''))
      .attr('x', 12)
      .attr('y', 4)
      .attr('font-size', '10px')
      .attr('fill', '#9ca3af')
      .attr('font-family', 'monospace')

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as CommitNode).x!)
        .attr('y1', d => (d.source as CommitNode).y!)
        .attr('x2', d => (d.target as CommitNode).x!)
        .attr('y2', d => (d.target as CommitNode).y!)

      node.attr('transform', d => `translate(${d.x},${d.y})`)
    })

    // Node interactions
    node.on('click', (event, d) => {
      setSelectedCommit(d)
    })

    node.on('mouseenter', function(event, d) {
      d3.select(this).select('circle')
        .transition()
        .duration(200)
        .attr('r', 12)
        .attr('fill', '#60a5fa')
    })

    node.on('mouseleave', function(event, d) {
      d3.select(this).select('circle')
        .transition()
        .duration(200)
        .attr('r', 8)
        .attr('fill', '#3b82f6')
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
    <div className="border border-gray-800 bg-black">
      <div className="border-b border-gray-800 p-4 flex items-center justify-between">
        <div>
          <h3 className="text-white font-mono text-sm">COMMIT.HISTORY.GRAPH</h3>
          <p className="text-gray-400 font-mono text-xs">
            Interactive D3.js visualization • {commits.length} commits
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setDimensions({ width: 1200, height: 600 })}
            className="px-3 py-1 bg-gray-900 text-gray-300 font-mono text-xs hover:bg-gray-800 border border-gray-700"
          >
            RESET.VIEW
          </button>
        </div>
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="bg-black"
        />

        {selectedCommit && (
          <div className="absolute top-4 right-4 bg-gray-900 border border-gray-700 p-4 max-w-md">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white font-mono text-xs">COMMIT.DETAILS</h4>
              <button
                onClick={() => setSelectedCommit(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div>
                <span className="text-gray-400">SHA:</span>
                <span className="text-white ml-2">{selectedCommit.sha.substring(0, 8)}</span>
              </div>
              <div>
                <span className="text-gray-400">Author:</span>
                <span className="text-white ml-2">{selectedCommit.author}</span>
              </div>
              <div>
                <span className="text-gray-400">Email:</span>
                <span className="text-white ml-2">{selectedCommit.email}</span>
              </div>
              <div>
                <span className="text-gray-400">Date:</span>
                <span className="text-white ml-2">{selectedCommit.date.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-gray-400">Message:</span>
                <p className="text-white mt-1">{selectedCommit.message}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
