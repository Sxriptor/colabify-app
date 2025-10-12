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

    // Add axes
    const xAxis = d3.axisBottom(xScale)
      .ticks(8)
      .tickFormat(d3.timeFormat('%b %d') as any)

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .attr('color', '#6b7280')
      .selectAll('text')
      .attr('font-family', 'monospace')
      .attr('font-size', '10px')

    // Draw timeline line
    const line = d3.line<typeof data[0]>()
      .x(d => xScale(d.date))
      .y((d, i) => yScale(i))
      .curve(d3.curveMonotoneX)

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2)
      .attr('d', line)

    // Add commit points
    g.selectAll('circle')
      .data(data)
      .join('circle')
      .attr('cx', d => xScale(d.date))
      .attr('cy', (d, i) => yScale(i))
      .attr('r', 4)
      .attr('fill', '#3b82f6')
      .attr('stroke', '#1e40af')
      .attr('stroke-width', 2)
      .attr('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', 6)

        // Show tooltip
        const tooltip = g.append('g')
          .attr('class', 'tooltip')
          .attr('transform', `translate(${xScale(d.date)},${yScale(data.indexOf(d)) - 20})`)

        tooltip.append('rect')
          .attr('x', -100)
          .attr('y', -40)
          .attr('width', 200)
          .attr('height', 35)
          .attr('fill', '#1f2937')
          .attr('stroke', '#4b5563')

        tooltip.append('text')
          .attr('text-anchor', 'middle')
          .attr('y', -25)
          .attr('fill', '#fff')
          .attr('font-family', 'monospace')
          .attr('font-size', '10px')
          .text(d.message.substring(0, 25))

        tooltip.append('text')
          .attr('text-anchor', 'middle')
          .attr('y', -12)
          .attr('fill', '#9ca3af')
          .attr('font-family', 'monospace')
          .attr('font-size', '9px')
          .text(d.author)
      })
      .on('mouseleave', function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', 4)

        g.selectAll('.tooltip').remove()
      })

  }, [commits])

  return (
    <div className="border border-gray-800 bg-black">
      <div className="border-b border-gray-800 p-4">
        <h3 className="text-white font-mono text-sm">BRANCH.TIMELINE</h3>
        <p className="text-gray-400 font-mono text-xs">
          Chronological commit history
        </p>
      </div>
      <div className="p-4">
        <svg ref={svgRef} width={1200} height={300} className="bg-black" />
      </div>
    </div>
  )
}
