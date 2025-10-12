'use client'

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { GitHubCommit } from '../types'

interface ContributorGraphProps {
  commits: GitHubCommit[]
}

interface ContributorData {
  name: string
  email: string
  commits: number
  additions: number
  deletions: number
  avatar?: string
}

export function ContributorGraph({ commits }: ContributorGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || commits.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Aggregate contributor data
    const contributorMap = new Map<string, ContributorData>()

    commits.forEach(commit => {
      const email = commit.commit.author.email
      const existing = contributorMap.get(email)

      if (existing) {
        existing.commits++
        existing.additions += commit.stats?.additions || 0
        existing.deletions += commit.stats?.deletions || 0
      } else {
        contributorMap.set(email, {
          name: commit.commit.author.name,
          email,
          commits: 1,
          additions: commit.stats?.additions || 0,
          deletions: commit.stats?.deletions || 0,
          avatar: commit.author?.avatar_url
        })
      }
    })

    const data = Array.from(contributorMap.values())
      .sort((a, b) => b.commits - a.commits)

    const width = 1200
    const height = 400
    const margin = { top: 40, right: 40, bottom: 60, left: 60 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Create scales
    const xScale = d3.scaleBand()
      .domain(data.map(d => d.name))
      .range([0, innerWidth])
      .padding(0.2)

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.commits) || 0])
      .range([innerHeight, 0])

    // Add axes
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .attr('color', '#6b7280')
      .selectAll('text')
      .attr('font-family', 'monospace')
      .attr('font-size', '10px')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5))
      .attr('color', '#6b7280')
      .selectAll('text')
      .attr('font-family', 'monospace')
      .attr('font-size', '10px')

    // Add bars
    g.selectAll('rect')
      .data(data)
      .join('rect')
      .attr('x', d => xScale(d.name)!)
      .attr('y', d => yScale(d.commits))
      .attr('width', xScale.bandwidth())
      .attr('height', d => innerHeight - yScale(d.commits))
      .attr('fill', '#3b82f6')
      .attr('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('fill', '#60a5fa')

        // Show tooltip
        const tooltip = g.append('g')
          .attr('class', 'tooltip')
          .attr('transform', `translate(${xScale(d.name)! + xScale.bandwidth() / 2},${yScale(d.commits) - 10})`)

        tooltip.append('rect')
          .attr('x', -80)
          .attr('y', -60)
          .attr('width', 160)
          .attr('height', 55)
          .attr('fill', '#1f2937')
          .attr('stroke', '#4b5563')

        tooltip.append('text')
          .attr('text-anchor', 'middle')
          .attr('y', -40)
          .attr('fill', '#fff')
          .attr('font-family', 'monospace')
          .attr('font-size', '11px')
          .text(d.name)

        tooltip.append('text')
          .attr('text-anchor', 'middle')
          .attr('y', -25)
          .attr('fill', '#9ca3af')
          .attr('font-family', 'monospace')
          .attr('font-size', '9px')
          .text(`${d.commits} commits`)

        tooltip.append('text')
          .attr('text-anchor', 'middle')
          .attr('y', -12)
          .attr('fill', '#22c55e')
          .attr('font-family', 'monospace')
          .attr('font-size', '9px')
          .text(`+${d.additions} additions`)
      })
      .on('mouseleave', function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('fill', '#3b82f6')

        g.selectAll('.tooltip').remove()
      })

  }, [commits])

  return (
    <div className="border border-gray-800 bg-black">
      <div className="border-b border-gray-800 p-4">
        <h3 className="text-white font-mono text-sm">CONTRIBUTOR.ACTIVITY</h3>
        <p className="text-gray-400 font-mono text-xs">
          Commits per contributor
        </p>
      </div>
      <div className="p-4">
        <svg ref={svgRef} width={1200} height={400} className="bg-black" />
      </div>
    </div>
  )
}
