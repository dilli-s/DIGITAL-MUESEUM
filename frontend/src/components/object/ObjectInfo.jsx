import React from 'react';

const ObjectInfo = ({ objectData }) => {
  const fields = [
    { label: 'Name', value: objectData.name },
    { label: 'Local/Common Name', value: objectData.localName },
    { label: 'Scientific Name', value: objectData.scientificName },
    { label: 'Period', value: objectData.period },
    { label: 'Date', value: objectData.date },
    { label: 'Origin', value: objectData.origin },
    { label: 'Category', value: objectData.category }
  ].filter(f => f.value);

  return (
    <div className="bg-neutral-50 p-6 rounded-xl border border-neutral-200 self-start">
      <h3 className="text-lg font-bold text-neutral-900 mb-4">Basic Information</h3>
      <dl className="space-y-4 text-sm">
        {fields.map((field, index) => (
          <div key={index} className="flex flex-col border-b border-neutral-200 pb-3 last:border-0 last:pb-0">
            <dt className="text-neutral-500 mb-1">{field.label}</dt>
            <dd className="font-medium text-neutral-900">{field.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

export default ObjectInfo;
