function renderTable(headers, rows) {
  const headerRow = `| ${headers.join(' | ')} |`;
  const separator = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.map((cell) => String(cell ?? '').replace(/\n/g, ' ')).join(' | ')} |`);
  return [headerRow, separator, ...body].join('\n');
}

export function downloadMarkdownReport(title, sections = [], filename = 'report') {
  const lines = [`# ${title}`, '', `Generated: ${new Date().toLocaleString()}`, ''];

  sections.forEach((section) => {
    if (!section) return;
    lines.push(`## ${section.title}`, '');

    if (section.summary) {
      lines.push(section.summary, '');
    }

    if (Array.isArray(section.items) && section.items.length) {
      section.items.forEach((item) => lines.push(`- ${item}`));
      lines.push('');
    }

    if (section.table && section.table.headers?.length && section.table.rows?.length) {
      lines.push(renderTable(section.table.headers, section.table.rows), '');
    }
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
