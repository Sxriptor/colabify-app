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

    // Add definitions for gradients and filters
    const defs = svg.append('defs')
    
    // Glow filter
    const filter = defs.append('filter')
      .attr('id', 'barGlow')
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

    // Gradient for bars
    const barGradient = defs.append('linearGradient')
      .attr('id', 'barGradient')
      .attr('x1', '0%')
      .attr('y1', '100%')
      .attr('x2', '0%')
      .attr('y2', '0%')

    barGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#0891b2')
      .attr('stop-opacity', 0.8)

    barGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#00e0ff')
      .attr('stop-opacity', 1)

    // Add bars with animation
    g.selectAll('rect')
      .data(data)
      .join('rect')
      .attr('x', d => xScale(d.name)!)
      .attr('y', innerHeight)
      .attr('width', xScale.bandwidth())
      .attr('height', 0)
      .attr('fill', 'url(#barGradient)')
      .attr('filter', 'url(#barGlow)')
      .attr('cursor', 'pointer')
      .attr('rx', 4)
      .transition()
      .delay((d, i) => i * 100)
      .duration(1000)
      .ease(d3.easeElastic)
      .attr('y', d => yScale(d.commits))
      .attr('height', d => innerHeight - yScale(d.commits))
      .selection()
      .on('mouseenter', function(event, d) {
        d3.select(this)
          .transition()
          .duration(300)
          .attr('fill', '#60a5fa')
          .attr('filter', 'url(#barGlow) brightness(1.2)')

        // Show tooltip with fade in
        const tooltip = g.append('g')
          .attr('class', 'tooltip')
          .attr('transform', `translate(${xScale(d.name)! + xScale.bandwidth() / 2},${yScale(d.commits) - 20})`)
          .attr('opacity', 0)

        tooltip.append('rect')
          .attr('x', -90)
          .attr('y', -75)
          .attr('width', 180)
          .attr('height', 70)
          .attr('fill', '#0f172a')
          .attr('stroke', '#334155')
          .attr('stroke-width', 1)
          .attr('rx', 8)
          .attr('filter', 'url(#barGlow)')

        tooltip.append('text')
          .attr('text-anchor', 'middle')
          .attr('y', -52)
          .attr('fill', '#e2e8f0')
          .attr('font-family', 'ui-monospace, monospace')
          .attr('font-size', '12px')
          .attr('font-weight', '600')
          .text(d.name)

        tooltip.append('text')
          .attr('text-anchor', 'middle')
          .attr('y', -35)
          .attr('fill', '#00e0ff')
          .attr('font-family', 'ui-monospace, monospace')
          .attr('font-size', '10px')
          .text(`${d.commits} commits`)

        tooltip.append('text')
          .attr('text-anchor', 'middle')
          .attr('y', -20)
          .attr('fill', '#22c55e')
          .attr('font-family', 'ui-monospace, monospace')
          .attr('font-size', '9px')
          .text(`+${d.additions} additions`)

        tooltip.append('text')
          .attr('text-anchor', 'middle')
          .attr('y', -8)
          .attr('fill', '#ef4444')
          .attr('font-family', 'ui-monospace, monospace')
          .attr('font-size', '9px')
          .text(`-${d.deletions} deletions`)

        tooltip.transition()
          .duration(200)
          .attr('opacity', 1)
      })
      .on('mouseleave', function() {
        d3.select(this)
          .transition()
          .duration(300)
          .attr('fill', 'url(#barGradient)')
          .attr('filter', 'url(#barGlow)')

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
        <h3 className="text-transparent bg-clip-text bg-gradient-to-r from-[#00e0ff] to-[#0891b2] font-mono text-sm font-semibold tracking-wide">
          CONTRIBUTOR ACTIVITY
        </h3>
        <p className="text-gray-500 font-mono text-xs mt-1">
          Code contributions by team member
        </p>
      </div>
      <div className="p-6">
        <svg ref={svgRef} width={1200} height={420} className="bg-gradient-to-br from-[#050509] via-[#0a0f1a] to-[#050509]" />
      </div>
    </div>
  )
}
