'use client'

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { GitHubCommit } from '../types'

interface BranchTimelineProps {
  commits: GitHubCommit[]
  branches?: any[]
}

export function BranchTimeline({ commits, branches = [] }: BranchTimelineProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || commits.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = 1200
    const height = 300
    const margin = { top: 40, right: 40, bottom: 40, left: 60 }
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
      sha: c.sha
    })).sort((a, b) => a.date.getTime() - b.date.getTime())

    // Create scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(data, d => d.date) as [Date, Date])
      .range([0, innerWidth])

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, (d, i) => i) || 0])
      .range([innerHeight, 0])

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
      .attr('stdDeviation', '2')
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
      .attr('stop-opacity', 0.8)

    gradient.append('stop')
      .attr('offset', '50%')
      .attr('stop-color', '#00e0ff')
      .attr('stop-opacity', 0.8)

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#a855f7')
      .attr('stop-opacity', 0.8)

    // Add axes with custom styling
    const xAxis = d3.axisBottom(xScale)
      .ticks(8)
      .tickFormat(d3.timeFormat('%b %d') as any)

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .attr('color', '#475569')
      .selectAll('text')
      .attr('font-family', 'ui-monospace, monospace')
      .attr('font-size', '10px')
      .attr('fill', '#64748b')

    // Draw timeline line with gradient
    const line = d3.line<typeof data[0]>()
      .x(d => xScale(d.date))
      .y((d, i) => yScale(i))
      .curve(d3.curveCatmullRom.alpha(0.5))

    const path = g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', 'url(#timelineGradient)')
      .attr('stroke-width', 3)
      .attr('filter', 'url(#timelineGlow)')
      .attr('d', line)
      .attr('stroke-dasharray', function() {
        const length = (this as SVGPathElement).getTotalLength()
        return `${length} ${length}`
      })
      .attr('stroke-dashoffset', function() {
        return (this as SVGPathElement).getTotalLength()
      })

    // Animate line drawing
    path.transition()
      .duration(2500)
      .ease(d3.easeQuadInOut)
      .attr('stroke-dashoffset', 0)

    // Add commit points with staggered animation
    g.selectAll('circle')
      .data(data)
      .join('circle')
      .attr('cx', d => xScale(d.date))
      .attr('cy', (d, i) => yScale(i))
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
      .transition()
      .delay((d, i) => i * 30)
      .duration(600)
      .ease(d3.easeElastic)
      .attr('r', 5)
      .selection()
      .on('mouseenter', function(event, d) {
        d3.select(this)
          .transition()
          .duration(300)
          .ease(d3.easeElastic)
          .attr('r', 8)

        // Show tooltip with fade in
        const tooltip = g.append('g')
          .attr('class', 'tooltip')
          .attr('transform', `translate(${xScale(d.date)},${yScale(data.indexOf(d)) - 30})`)
          .attr('opacity', 0)

        tooltip.append('rect')
          .attr('x', -110)
          .attr('y', -50)
          .attr('width', 220)
          .attr('height', 45)
          .attr('fill', '#0f172a')
          .attr('stroke', '#334155')
          .attr('stroke-width', 1)
          .attr('rx', 6)
          .attr('filter', 'url(#timelineGlow)')

        tooltip.append('text')
          .attr('text-anchor', 'middle')
          .attr('y', -32)
          .attr('fill', '#e2e8f0')
          .attr('font-family', 'ui-monospace, monospace')
          .attr('font-size', '11px')
          .attr('font-weight', '500')
          .text(d.message.substring(0, 28) + (d.message.length > 28 ? '...' : ''))

        tooltip.append('text')
          .attr('text-anchor', 'middle')
          .attr('y', -16)
          .attr('fill', '#94a3b8')
          .attr('font-family', 'ui-monospace, monospace')
          .attr('font-size', '9px')
          .text(d.author)

        tooltip.transition()
          .duration(200)
          .attr('opacity', 1)
      })
      .on('mouseleave', function() {
        d3.select(this)
          .transition()
          .duration(300)
          .ease(d3.easeElastic)
          .attr('r', 5)

        g.selectAll('.tooltip')
          .transition()
          .duration(150)
          .attr('opacity', 0)
          .remove()
      })

  }, [commits])

  return (
    <div className="border border-gray-800/50 bg-gradient-to-br from-[#050509] via-[#0a0f1a] to-[#050509] rounded-lg overflow-hidden">
      <div className="border-b border-gray-800/50 p-5 bg-black/40 backdrop-blur-sm">
        <h3 className="text-transparent bg-clip-text bg-gradient-to-r from-[#22c55e] to-[#00e0ff] font-mono text-sm font-semibold tracking-wide">
          BRANCH TIMELINE
        </h3>
        <p className="text-gray-500 font-mono text-xs mt-1">
          Chronological commit progression • {commits.length} commits
        </p>
      </div>
      <div className="p-6">
        <svg ref={svgRef} width={1200} height={320} className="bg-gradient-to-br from-[#050509] via-[#0a0f1a] to-[#050509]" />
      </div>
    </div>
  )
}
