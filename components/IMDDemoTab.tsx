import React from 'react';
import Card, { CardTitle } from './Card';
import { ImdPhysicsPlayground } from './ImdPhysicsPlayground';

const IMDDemoTab: React.FC = () => {
    return (
        <div className="space-y-6">
            <Card>
                <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-2">
                    <div>
                        <CardTitle>IMD Physics Collision Playground</CardTitle>
                        <p className="text-sm text-slate-400 mt-1">
                            Direct-touch interactive carrier dragging workbench. Observe 2-Tone 3rd Order, 3-Tone 3rd Order, and 5th Order intermodulation ghost spurs glide across the band in real time with dynamic collision beams and magnetic snap-to-clean-pocket physics.
                        </p>
                    </div>
                </div>

                <div className="mt-4">
                    <ImdPhysicsPlayground />
                </div>
            </Card>
        </div>
    );
};

export default IMDDemoTab;
