'use client'

import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { GitHubCommit } from '../types'

interface BranchTimelineProps {
  commits: GitHubCommit[]
  branches?: any[]
}

export function BranchTimeline({ commits, branches = [] }: BranchTimelineProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoveredCommit, setHoveredCommit] = useState<any>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!svgRef.current || commits.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = 1200
    const height = 200
    const margin = { top: 30, right: 40, bottom: 50, left: 40 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Parse dates and sort commits
    const data = commits.map(c => ({
      date: new Date(c.commit.author.date),
      author: c.commit.author.name,
      message: c.commit.message.split('\n')[0],
      sha: c.sha,
      additions: c.stats?.additions || 0,
      deletions: c.stats?.deletions || 0
    })).sort((a, b) => a.date.getTime() - b.date.getTime())

    // Create scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(data, d => d.date) as [Date, Date])
      .range([0, innerWidth])

    // Add definitions for gradients and filters
    const defs = svg.append('defs')
    
    // Glow filter
    const filter = defs.append('filter')
      .attr('id', 'timelineGlow')
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

    // Gradient for timeline
    const gradient = defs.append('linearGradient')
      .attr('id', 'timelineGradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '0%')

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#22c55e')

    gradient.append('stop')
      .attr('offset', '50%')
      .attr('stop-color', '#00e0ff')

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#a855f7')

    // Add x-axis
    const xAxis = d3.axisBottom(xScale)
      .ticks(6)
      .tickFormat(d3.timeFormat('%b %d') as any)

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .call(g => g.select('.domain').attr('stroke', '#334155'))
      .call(g => g.selectAll('.tick line').attr('stroke', '#334155'))
      .call(g => g.selectAll('.tick text')
        .attr('fill', '#64748b')
        .attr('font-family', 'ui-monospace, monospace')
        .attr('font-size', '11px'))

    // Draw baseline
    g.append('line')
      .attr('x1', 0)
      .attr('y1', innerHeight / 2)
      .attr('x2', 0)
      .attr('y2', innerHeight / 2)
      .attr('stroke', 'url(#timelineGradient)')
      .attr('stroke-width', 2)
      .attr('opacity', 0.3)
      .transition()
      .duration(1500)
      .attr('x2', innerWidth)

    // Add commit points
    const circles = g.selectAll('circle')
      .data(data)
      .join('circle')
      .attr('cx', d => xScale(d.date))
      .attr('cy', innerHeight / 2)
      .attr('r', 0)
      .attr('fill', (d, i) => {
        const ratio = i / data.length
        return ratio < 0.33 ? '#22c55e' : ratio < 0.66 ? '#00e0ff' : '#a855f7'
      })
      .attr('stroke', (d, i) => {
        const ratio = i / data.length
        return ratio < 0.33 ? '#16a34a' : ratio < 0.66 ? '#0891b2' : '#7c3aed'
      })
      .attr('stroke-width', 2)
      .attr('filter', 'url(#timelineGlow)')
      .attr('cursor', 'pointer')

    // Animate circles in
    circles.transition()
      .delay((d, i) => 500 + i * 20)
      .duration(600)
      .ease(d3.easeElastic)
      .attr('r', d => {
        const activity = d.additions + d.deletions
        return activity > 100 ? 8 : activity > 50 ? 6 : 5
      })

    // Interactions
    circles.on('mouseenter', function(event, d) {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('r', d => {
          const activity = d.additions + d.deletions
          return activity > 100 ? 12 : activity > 50 ? 10 : 8
        })

      setHoveredCommit(d)
      setMousePos({ x: event.pageX, y: event.pageY })
    })

    circles.on('mouseleave', function(event, d) {
      d3.select(this)
        .transition()
        .duration(200)
        .attr('r', d => {
          const activity = d.additions + d.deletions
          return activity > 100 ? 8 : activity > 50 ? 6 : 5
        })

      setHoveredCommit(null)
    })

  }, [commits])

  return (
    <div className="border border-gray-800/50 bg-gradient-to-br from-[#050509] via-[#0a0f1a] to-[#050509] rounded-lg overflow-hidden">
      <div className="border-b border-gray-800/50 p-5 bg-black/40 backdrop-blur-sm">
        <h3 className="text-transparent bg-clip-text bg-gradient-to-r from-[#22c55e] to-[#00e0ff] font-mono text-sm font-semibold tracking-wide">
          COMMIT TIMELINE
        </h3>
        <p className="text-gray-500 font-mono text-xs mt-1">
          Chronological progression • {commits.length} commits over time
        </p>
      </div>
      <div className="p-6 relative">
        <svg ref={svgRef} width={1200} height={200} className="bg-gradient-to-br from-[#050509] via-[#0a0f1a] to-[#050509]" />
        
        {hoveredCommit && (
          <div 
            className="fixed z-50 bg-gradient-to-br from-gray-900/95 to-gray-950/95 backdrop-blur-md border border-gray-700/50 rounded-lg p-4 shadow-2xl pointer-events-none"
            style={{
              left: mousePos.x + 15,
              top: mousePos.y + 15,
              maxWidth: '300px'
            }}
          >
            <div className="space-y-2 text-xs font-mono">
              <div className="text-[#00e0ff] font-semibold truncate">
                {hoveredCommit.message}
              </div>
              <div className="text-gray-400">
                {hoveredCommit.author}
              </div>
              <div className="text-gray-500 text-[10px]">
                {new Date(hoveredCommit.date).toLocaleString()}
              </div>
              {(hoveredCommit.additions > 0 || hoveredCommit.deletions > 0) && (
                <div className="flex items-center space-x-2 pt-1 border-t border-gray-800">
                  <span className="text-[#22c55e]">+{hoveredCommit.additions}</span>
                  <span className="text-[#ef4444]">-{hoveredCommit.deletions}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
